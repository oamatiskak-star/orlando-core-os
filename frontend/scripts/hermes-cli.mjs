#!/usr/bin/env node
/**
 * Hermes CLI — je AI CEO-assistent in de terminal, net als `claude`.
 *
 * Geen menu van vaste commando's: Hermes heeft een ECHTE shell (bash),
 * bestandstoegang en kan zo elk commando uitvoeren en begrijpend lezen.
 *
 * Gebruik:
 *   hermes                 interactieve chat (REPL)
 *   hermes "vraag..."      één vraag, antwoord, klaar
 *   hermes --help
 *
 * Env (auto-geladen uit .env.prod + frontend/.env.local + .env.local):
 *   ANTHROPIC_API_KEY (verplicht)
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { exec } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const FRONTEND = resolve(__dirname, '..')

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnv(resolve(REPO_ROOT, '.env.prod'))
loadEnv(resolve(FRONTEND, '.env.local'))
loadEnv(resolve(REPO_ROOT, '.env.local'))

const c = {
  dim: s => `\x1b[2m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`${c.bold('hermes')} — je AI CEO-assistent in de terminal

  hermes                 interactieve chat
  hermes "<vraag>"       één vraag beantwoorden en stoppen
  hermes --help

In de chat: ${c.dim('/exit')} stoppen · ${c.dim('/reset')} gesprek wissen · ${c.dim('/help')}
Hermes heeft een echte shell + bestandstoegang. Risicovolle acties vraagt hij eerst.`)
  process.exit(0)
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  console.error(c.red('Ontbrekende env: ANTHROPIC_API_KEY (zet in .env.prod of frontend/.env.local)'))
  process.exit(1)
}

const { default: Anthropic } = await import(resolve(FRONTEND, 'node_modules/@anthropic-ai/sdk/index.mjs'))
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const MODEL = 'claude-opus-4-8'
const MAX_STEPS = 30

// ── Tools: een echte shell + bestandstoegang (zoals Claude Code) ──────────
const TOOLS = [
  {
    name: 'bash',
    description:
      'Voer een shell-commando uit op Orlando\'s Mac (zsh). Hiermee ken je ELK commando: git, gh, psql, supabase, curl, npm, vercel, ls, grep, enz. Werkdirectory blijft behouden tussen aanroepen. Gebruik dit om te onderzoeken, lezen en handelen.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Het shell-commando.' },
        cwd: { type: 'string', description: 'Optionele werkdirectory (absoluut pad).' },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Lees een tekstbestand. Geef een absoluut pad. Gebruik dit om code/config/logs te begrijpen voordat je handelt.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        max_bytes: { type: 'integer', description: 'Max bytes (default 60000).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Schrijf/overschrijf een tekstbestand volledig. Geef een absoluut pad. Telt als risicovolle actie (vraagt bevestiging).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
]

// Risicovolle patronen → bevestiging vragen (default-deny op productie-ingrepen).
const DANGER = /\b(rm\s+-rf|rm\s+-fr|sudo|mkfs|dd\s+if=|>\s*\/dev\/|drop\s+(table|database|schema)|truncate\b|delete\s+from|git\s+push|--force|-f\b.*push|reset\s+--hard|vercel\s+(deploy|promote)|supabase\s+db\s+(push|reset)|stripe\b|shutdown|reboot|kill\s+-9\s+1\b|:\(\)\s*\{)/i

let cwd = process.cwd()

function runBash(command, dirOverride) {
  return new Promise(res => {
    const useCwd = dirOverride || cwd
    exec(command, { cwd: useCwd, shell: '/bin/zsh', timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      // werkdirectory bijhouden bij 'cd'
      if (!err && /^\s*cd\s+/.test(command) && !dirOverride) {
        exec('pwd', { cwd: useCwd, shell: '/bin/zsh' }, (_e, out) => { if (out) cwd = out.trim() })
      }
      const out = (stdout || '').slice(-12000)
      const errOut = (stderr || '').slice(-4000)
      res({
        ok: !err,
        exit_code: err?.code ?? 0,
        stdout: out,
        stderr: errOut,
        ...(err && err.killed ? { note: 'timeout/gekilld' } : {}),
      })
    })
  })
}

async function execTool(name, input, confirm) {
  try {
    if (name === 'bash') {
      const command = String(input.command || '')
      if (DANGER.test(command)) {
        const allowed = await confirm(`risicovol commando: ${command}`)
        if (!allowed) return { ok: false, error: 'Door Orlando geweigerd (risicovol).' }
      }
      return await runBash(command, input.cwd && String(input.cwd))
    }
    if (name === 'read_file') {
      const p = String(input.path || '')
      if (!existsSync(p)) return { ok: false, error: 'bestaat niet' }
      const max = typeof input.max_bytes === 'number' ? input.max_bytes : 60000
      const data = readFileSync(p, 'utf8').slice(0, max)
      return { ok: true, content: data }
    }
    if (name === 'write_file') {
      const p = String(input.path || '')
      const allowed = await confirm(`schrijf bestand: ${p}`)
      if (!allowed) return { ok: false, error: 'Door Orlando geweigerd.' }
      const { writeFileSync, mkdirSync } = await import('node:fs')
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, String(input.content ?? ''), 'utf8')
      return { ok: true, written: p, bytes: Buffer.byteLength(String(input.content ?? '')) }
    }
    return { ok: false, error: `onbekende tool: ${name}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fout' }
  }
}

const SYSTEM = `Je bent Hermes, de AI CEO-assistent van Orlando (vastgoed, bouw, SaaS, AI, media).
Je draait in zijn terminal op zijn Mac en werkt zoals een senior engineer/operator: je BEGRIJPT de vraag, ONDERZOEKT zelf via de shell, en HANDELT.

Je hebt echte tools:
- bash: elk shell-commando (git, gh, psql, supabase, curl, npm, vercel, grep, ...). Hiermee ken je alle commando's en alle data.
- read_file / write_file: bestanden lezen en schrijven.

WERKWIJZE (zoals Claude Code):
- Verzin niets. Vraag je naar uploads/problemen/status? Zoek het echt op via bash/SQL/logs en rapporteer feiten.
- Voer meerdere stappen autonoom uit tot de taak af is; leg kort uit wat je deed.
- Risicovolle/productie-acties (deploys, merges, force-push, prijzen, Stripe, data verwijderen) voer je pas uit na expliciete bevestiging — de tool vraagt dat automatisch; stel ze voor, doe ze niet stiekem.

STIJL: Nederlands, direct, technisch, kort. Toon concrete output, geen gewauwel.`

async function agentTurn(messages, confirm, onText, onTool) {
  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    })
    const textBlocks = resp.content.filter(b => b.type === 'text')
    if (textBlocks.length) onText(textBlocks.map(b => b.text).join('\n').trim())

    const toolUses = resp.content.filter(b => b.type === 'tool_use')
    if (resp.stop_reason !== 'tool_use' || !toolUses.length) return

    messages.push({ role: 'assistant', content: resp.content })
    const results = []
    for (const tu of toolUses) {
      onTool(tu.name, tu.input)
      const r = await execTool(tu.name, tu.input || {}, confirm)
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(r), is_error: !r.ok })
    }
    messages.push({ role: 'user', content: results })
  }
  onText(c.yellow('[gestopt: max stappen bereikt]'))
}

function toolLine(name, input) {
  if (name === 'bash') return c.dim(`  $ ${String(input.command || '').split('\n')[0].slice(0, 100)}`)
  if (name === 'read_file') return c.dim(`  read ${input.path}`)
  if (name === 'write_file') return c.dim(`  write ${input.path}`)
  return c.dim(`  ${name}`)
}

// ── one-shot vs interactief ───────────────────────────────────────────────
const promptArg = process.argv.slice(2).filter(a => !a.startsWith('-')).join(' ').trim()

async function main() {
  if (promptArg) {
    // one-shot: weiger risicovolle acties automatisch (geen mens aan toetsenbord-garantie)
    const messages = [{ role: 'user', content: promptArg }]
    await agentTurn(
      messages,
      async () => false,
      t => console.log(t),
      (n, i) => console.error(toolLine(n, i))
    )
    return
  }

  const rl = readline.createInterface({ input: stdin, output: stdout })
  console.log(c.bold('Hermes') + c.dim(' — terminal-modus. /exit om te stoppen, /reset wist het gesprek.\n'))
  let messages = []
  const confirm = async desc => {
    const ans = (await rl.question(c.yellow(`⚠ ${desc}\n  uitvoeren? [j/N] `))).trim().toLowerCase()
    return ans === 'j' || ans === 'ja' || ans === 'y'
  }
  while (true) {
    let line
    try { line = (await rl.question(c.cyan('› '))).trim() } catch { break }
    if (!line) continue
    if (line === '/exit' || line === '/quit') break
    if (line === '/reset') { messages = []; console.log(c.dim('gesprek gewist.')); continue }
    if (line === '/help') { console.log(c.dim('Typ gewoon je vraag. Hermes heeft shell+bestanden. /exit /reset')); continue }
    messages.push({ role: 'user', content: line })
    try {
      await agentTurn(
        messages,
        confirm,
        t => console.log('\n' + t + '\n'),
        (n, i) => console.log(toolLine(n, i))
      )
    } catch (e) {
      console.error(c.red('fout: ' + (e instanceof Error ? e.message : String(e))))
    }
  }
  rl.close()
}

main().catch(e => { console.error(c.red(String(e?.stack || e))); process.exit(1) })
