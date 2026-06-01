import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildContinuePrompt, type ContinuePromptContext } from '@/lib/continue-prompt'

export const dynamic = 'force-dynamic'

// Worktree → host. Aquier-werk draait op CLI-R (worker, capability aquier-product);
// de rest (orlando-core-os) op CLI-L (orchestrator).
function resolveTarget(ctx: ContinuePromptContext): { machine_id: string; worktree_path: string; repo: string } {
  const hay = `${ctx.company ?? ''} ${ctx.tracker ?? ''} ${ctx.name ?? ''} ${ctx.route ?? ''}`.toLowerCase()
  const isAquier = /aquier|aquire|vastgoedscapler|modiwe software/.test(hay)
  return defaultsFor(isAquier ? 'cli-r' : 'cli-l')
}

function defaultsFor(machine: string): { machine_id: string; worktree_path: string; repo: string } {
  return machine === 'cli-r'
    ? { machine_id: 'cli-r', worktree_path: '~/Code/vastgoedscapler-saas', repo: 'oamatiskak-star/aquire' }
    : { machine_id: 'cli-l', worktree_path: '~/Code/orlando-core-os', repo: 'oamatiskak-star/orlando-core-os' }
}

// Stabiele hash voor een korte, deterministische tmux-sessienaam.
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return h
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const mode: 'new' | 'resume' = body.mode === 'new' ? 'new' : 'resume'
  const admin = createAdminClient()

  // Mobiel herkennen: expliciete client-vlag heeft voorrang, anders User-Agent.
  const ua = req.headers.get('user-agent') ?? ''
  const fromMobile = typeof body.from_mobile === 'boolean'
    ? body.from_mobile
    : /iphone|ipad|android|mobile/i.test(ua)

  let machine: string, worktreePath: string, repo: string, prompt: string, title: string, action: string

  if (mode === 'new') {
    // Nieuwe sessie — host kiest de gebruiker; geen resume-prompt.
    machine = body.machine === 'cli-r' ? 'cli-r' : 'cli-l'
    const def = defaultsFor(machine)
    worktreePath = typeof body.worktree === 'string' && body.worktree ? body.worktree : def.worktree_path
    repo = def.repo
    prompt = ''                       // leeg → listener opent alleen `claude` (verse sessie)
    title = 'Nieuwe Claude sessie'
    action = 'open_claude_new'
  } else {
    const ctx = body.context as ContinuePromptContext | undefined
    if (!ctx || !ctx.name) return NextResponse.json({ error: 'context vereist' }, { status: 400 })
    let target = resolveTarget(ctx)
    // Voorrang: een bestaande sessie op exact deze worktree.
    const { data: sess } = await admin
      .from('osm_sessions')
      .select('machine_id, worktree_path')
      .ilike('entity', `%${ctx.name}%`)
      .in('status', ['active', 'paused', 'context_full', 'crashed'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sess?.machine_id && sess.worktree_path) {
      target = { ...target, machine_id: sess.machine_id, worktree_path: sess.worktree_path }
    }
    machine = (body.machine_override === 'cli-l' || body.machine_override === 'cli-r')
      ? body.machine_override : target.machine_id
    worktreePath = target.worktree_path
    repo = target.repo
    prompt = buildContinuePrompt(ctx)
    title = ctx.name
    action = 'open_claude_resume'
  }

  // Bij mobiel: gedeelde tmux-sessie + Terminus-link (iPhone koppelt aan host-venster).
  const tmuxSession = fromMobile ? `${mode === 'new' ? 'new' : 'resume'}-${Math.abs(hashStr(title + machine + action)).toString(36).slice(0, 6)}` : null
  const terminusLink = fromMobile ? `ssh://${machine}` : null

  const { data, error } = await admin
    .from('osm_terminal_commands')
    .insert({
      machine_id: machine,
      worktree_path: worktreePath,
      repo,
      action,
      prompt,
      build_id: typeof body.build_id === 'string' ? body.build_id : null,
      title,
      from_mobile: fromMobile,
      tmux_session: tmuxSession,
      terminus_link: terminusLink,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true, id: data.id, mode, machine_id: machine, worktree_path: worktreePath,
    from_mobile: fromMobile, tmux_session: tmuxSession, terminus_link: terminusLink,
    attach_cmd: tmuxSession ? `ssh ${machine} -t 'tmux attach -t ${tmuxSession}'` : null,
  })
}
