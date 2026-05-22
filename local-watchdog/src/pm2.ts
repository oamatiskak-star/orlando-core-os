import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const execAsync = promisify(exec)

export interface PM2App {
  name: string
  pm_id: number
  pid: number
  pm2_env: {
    status: 'online' | 'stopping' | 'stopped' | 'launching' | 'errored' | 'one-launch-status' | string
    restart_time: number
    unstable_restarts: number
    pm_uptime: number
    pm_cwd?: string
    cwd?: string
    exec_interpreter?: string
    pm_err_log_path?: string
    pm_out_log_path?: string
  }
  monit?: { memory: number; cpu: number }
}

const PM2_BIN = process.env.PM2_BIN || 'pm2'

async function run(cmd: string, timeoutMs = 30_000): Promise<{ stdout: string; stderr: string }> {
  return execAsync(cmd, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 })
}

export async function listPM2Apps(): Promise<PM2App[]> {
  const { stdout } = await run(`${PM2_BIN} jlist`)
  const trimmed = stdout.trim()
  if (!trimmed) return []
  return JSON.parse(trimmed) as PM2App[]
}

export async function restartApp(name: string): Promise<void> {
  await run(`${PM2_BIN} restart ${shellEscape(name)} --update-env`)
}

export async function stopApp(name: string): Promise<void> {
  await run(`${PM2_BIN} stop ${shellEscape(name)}`)
}

export async function startApp(name: string): Promise<void> {
  await run(`${PM2_BIN} start ${shellEscape(name)}`)
}

export async function tailErrorLog(app: PM2App, lines = 60): Promise<string> {
  const path = app.pm2_env.pm_err_log_path
  if (!path || !existsSync(path)) return ''
  try {
    const { stdout } = await run(`tail -n ${lines} ${shellEscape(path)}`)
    return stdout
  } catch {
    return ''
  }
}

export interface RebuildResult {
  ran: boolean
  log: string
  error?: string
}

export async function rebuildApp(app: PM2App): Promise<RebuildResult> {
  const cwd = app.pm2_env.pm_cwd || app.pm2_env.cwd
  if (!cwd) return { ran: false, log: 'no cwd available' }
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return { ran: false, log: `no package.json in ${cwd}` }

  let pkg: { scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  } catch (err) {
    return { ran: false, log: `failed to parse package.json: ${err instanceof Error ? err.message : err}` }
  }

  const hasBuild = !!pkg.scripts?.build
  const steps: string[] = []
  try {
    steps.push(`cd ${shellEscape(cwd)}`)
    steps.push('npm install --no-audit --no-fund')
    if (hasBuild) steps.push('npm run build')
    const cmd = steps.join(' && ')
    const { stdout, stderr } = await run(cmd, 5 * 60 * 1000)
    return { ran: true, log: `cwd=${cwd}\nsteps=${steps.join(' && ')}\n--- stdout ---\n${stdout.slice(-2000)}\n--- stderr ---\n${stderr.slice(-2000)}` }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return {
      ran: true,
      log: `cwd=${cwd}\nsteps=${steps.join(' && ')}\n--- stdout ---\n${(e.stdout ?? '').slice(-2000)}\n--- stderr ---\n${(e.stderr ?? '').slice(-2000)}`,
      error: e.message ?? String(err)
    }
  }
}

function shellEscape(s: string): string {
  if (/^[A-Za-z0-9_\-./:=]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}
