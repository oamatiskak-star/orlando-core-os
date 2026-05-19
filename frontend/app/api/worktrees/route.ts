import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPO_ROOT = process.env.ORLANDO_REPO_ROOT ?? path.join(homedir(), 'Code/orlando-core-os')
const SESSION_FILE = path.join(homedir(), '.orlando-wt-sessions.json')

type WorktreeRaw = {
  path: string
  head: string
  branch: string
  bare: boolean
  locked: boolean
}

type SessionData = {
  sessions: Record<string, { machine: string; startedAt: string; pid: number }>
}

function parseWorktreeList(): WorktreeRaw[] {
  try {
    const out = execSync('git worktree list --porcelain', {
      cwd: REPO_ROOT,
      timeout: 5000,
      encoding: 'utf-8',
    })
    const worktrees: WorktreeRaw[] = []
    let current: Partial<WorktreeRaw> = {}
    for (const line of out.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeRaw)
        current = { path: line.slice(9), head: '', branch: '', bare: false, locked: false }
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5, 12)
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '')
      } else if (line === 'bare') {
        current.bare = true
      } else if (line === 'locked') {
        current.locked = true
      } else if (line === '') {
        if (current.path) {
          worktrees.push(current as WorktreeRaw)
          current = {}
        }
      }
    }
    if (current.path) worktrees.push(current as WorktreeRaw)
    return worktrees
  } catch {
    return []
  }
}

function getLastCommit(wtPath: string): { message: string; author: string; date: string } {
  try {
    const out = execSync(
      "git log -1 --pretty=format:%s|%an|%ar",
      { cwd: wtPath, timeout: 3000, encoding: 'utf-8' }
    )
    const [message = '', author = '', date = ''] = out.split('|')
    return { message: message.slice(0, 60), author, date }
  } catch {
    return { message: '', author: '', date: '' }
  }
}

function getDirtyCount(wtPath: string): number {
  try {
    const out = execSync('git status --porcelain', {
      cwd: wtPath, timeout: 3000, encoding: 'utf-8'
    })
    return out.split('\n').filter(Boolean).length
  } catch {
    return 0
  }
}

function readSessions(): SessionData['sessions'] {
  try {
    if (!existsSync(SESSION_FILE)) return {}
    const raw = readFileSync(SESSION_FILE, 'utf-8')
    return (JSON.parse(raw) as SessionData).sessions ?? {}
  } catch {
    return {}
  }
}

export async function GET() {
  const worktrees = parseWorktreeList()
  const sessions = readSessions()

  const result = worktrees.map((wt) => {
    const name = wt.path === REPO_ROOT ? 'main' : path.basename(wt.path)
    const commit = getLastCommit(wt.path)
    const dirty = getDirtyCount(wt.path)
    const session = sessions[name] ?? null

    return {
      name,
      path: wt.path,
      branch: wt.branch || '(detached)',
      head: wt.head,
      bare: wt.bare,
      locked: wt.locked,
      dirty,
      commit,
      session,
      isMain: wt.path === REPO_ROOT,
    }
  })

  return NextResponse.json({
    worktrees: result,
    repoRoot: REPO_ROOT,
    sessionCount: Object.keys(sessions).length,
    totalDirty: result.reduce((s, w) => s + w.dirty, 0),
  })
}
