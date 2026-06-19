/**
 * Browser Agent — LLM-gestuurde Chrome-agent voor affiliate-aanmeldingen.
 *
 * Hangt via CDP aan JOUW handmatig-gestarte Chrome (zie scripts/launch-chrome-autofill.sh),
 * leest elke pagina (DOM + labels + dropdown-opties), laat Claude beslissen welke acties
 * nodig zijn (typen / dropdown kiezen / Next klikken / aankruisen) en voert die uit.
 *
 * Pauzeert ALLEEN bij: captcha/2FA, login, ontbrekend verplicht gegeven, of vlak vóór de
 * FINALE verzendknop (account aanmaken / apply / pay) — die irreversibele klik bevestig jij.
 *
 * Draaien (na Chrome met debug-poort):
 *   cd local-agent && npx ts-node --transpile-only src/browser-agent.ts                 # huidige tab
 *   cd local-agent && npx ts-node --transpile-only src/browser-agent.ts --url <signup>  # open eerst deze URL
 *   AUTO_SUBMIT=1 ...                                                                    # ook de finale knop zelf klikken
 */
import 'dotenv/config'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { chromium, BrowserContext, Page } from 'playwright'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Brein: standaard lokaal/gratis via Ollama; 'anthropic' als je daar tegoed op zet.
const BACKEND = (process.env.BROWSER_AGENT_BACKEND ?? 'ollama').toLowerCase()
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_MODEL = process.env.BROWSER_AGENT_MODEL ?? 'claude-sonnet-4-6'
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
const MODEL = BACKEND === 'anthropic' ? ANTHROPIC_MODEL : OLLAMA_MODEL
const CDP_URL = process.env.BROWSER_REG_CDP_URL ?? 'http://127.0.0.1:9222'
const MAX_STEPS = parseInt(process.env.BROWSER_AGENT_MAX_STEPS ?? '20')
const AUTO_SUBMIT = process.env.AUTO_SUBMIT === '1'
if (BACKEND === 'anthropic' && !ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY ontbreekt in env.'); process.exit(1) }

const PROFILE = {
  first_name: 'Orlando', last_name: 'Amatiskak', full_name: 'Orlando Amatiskak',
  email: 'o.amatiskak@gmail.com', website: 'https://aquier.com', country: 'Netherlands',
  company: 'Modiwerijo Financial Management BV', kvk: '97494380', vat: 'NL868076314B01',
  payout: 'PayPal o.amatiskak@gmail.com', tax_form: 'W-8BEN-E (non-US entity)',
  phone: '+31630068831',
  about: 'Aquier (aquier.com) is a personal-finance, investing and real-estate knowledge base (~300 articles, EN + NL, NL-first, expanding). Operated under Modiwerijo Financial Management BV (Netherlands).',
  audience: 'Self-directed retail investors and small-business owners researching finance, investing, real estate and the tools to grow online. Primarily Dutch and English-speaking.',
  promotion: 'Content and SEO only: long-form articles, reviews and comparison content plus an email newsletter, built around organic search and editorial recommendations. No brand-keyword bidding, no incentivized traffic.',
}

const SYSTEM = `Je bent een browser-agent die affiliate-aanmeldformulieren invult namens deze gebruiker.
GEBRUIKERSPROFIEL (gebruik exact deze waarden):
${JSON.stringify(PROFILE, null, 2)}

Je krijgt per beurt de huidige pagina (URL, titel) en een lijst interactieve elementen met een 'ref'.
Geef UITSLUITEND JSON terug in dit formaat (geen uitleg eromheen):
{"actions":[{"action":"fill","ref":"r3","value":"..."},{"action":"select","ref":"r5","value":"<exacte optie-tekst>"},{"action":"check","ref":"r2"},{"action":"click","ref":"r9"}],"note":"korte status"}

Regels:
- Vul alleen lege velden die je zeker weet uit het profiel. Laat onbekende velden leeg.
- Bij een verplicht veld dat je niet uit het profiel kunt vullen (bv. telefoonnummer): {"actions":[],"human":"ontbrekend: <veld>"}.
- 'select' value = exact één van de aangeleverde opties (kies de best passende, bv. land=Netherlands, "hoe promoot je"=Website/Content/Blog, "ben je al klant"=No).
- Tussenstap-knoppen (Next, Continue, Add, Volgende) MAG je klikken om door te gaan.
- De FINALE knop (Submit / Apply / Create account / Register / Pay / Confirm) NIET klikken → {"actions":[...],"human":"klaar om te verzenden — controleer en bevestig"}.
- Captcha / 2FA / login / "verify you are human": {"actions":[],"human":"captcha/2fa/login"}.
- Niets meer te doen op deze pagina en geen knop om door te gaan: {"actions":[],"done":true}.
- Als 'Recente acties' laat zien dat een actie faalde (overslaan/FOUT) of niets veranderde: herhaal die actie NIET. Kies een ander element, of als er echt geen voortgang mogelijk is geef {"actions":[],"done":true}.`

type Element = { ref: string; tag: string; type: string; label: string; value: string; options?: string[] }
type AgentDecision = { actions?: { action: string; ref: string; value?: string }[]; human?: string; done?: boolean; note?: string }

async function snapshot(page: Page): Promise<Element[]> {
  return page.evaluate(() => {
    function lbl(el: Element): string {
      let t = ''
      const id = (el as HTMLElement).id
      if (id) { const l = document.querySelector(`label[for="${CSS.escape(id)}"]`); if (l) t += ' ' + (l.textContent || '') }
      const aria = el.getAttribute('aria-label'); if (aria) t += ' ' + aria
      const ph = el.getAttribute('placeholder'); if (ph) t += ' ' + ph
      const nm = el.getAttribute('name'); if (nm) t += ' ' + nm
      const lab = el.closest('label'); if (lab) t += ' ' + (lab.textContent || '')
      return t.replace(/\s+/g, ' ').trim().slice(0, 120)
    }
    const sel = 'input, textarea, select, button, [role=button], [role=combobox], a[href]'
    const out: { ref: string; tag: string; type: string; label: string; value: string; options?: string[] }[] = []
    let i = 0
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const e = el as HTMLInputElement
      const type = (e.getAttribute('type') || e.tagName).toLowerCase()
      if (['hidden'].includes(type)) continue
      const r = e.getBoundingClientRect()
      const st = getComputedStyle(e)
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none') continue
      if ((e as HTMLButtonElement).disabled) continue
      const tag = e.tagName.toLowerCase()
      const isLink = tag === 'a'
      const text = (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      // links alleen meenemen als ze op een knop lijken (kort, actie-achtig)
      if (isLink && (text.length === 0 || text.length > 30)) continue
      const ref = 'r' + (i++)
      e.setAttribute('data-agent-ref', ref)
      const item: { ref: string; tag: string; type: string; label: string; value: string; options?: string[] } = {
        ref, tag, type,
        label: (lbl(e) + ' ' + text).trim() || type,
        value: (e as HTMLInputElement).value ? '[filled]' : '',
      }
      if (tag === 'select') {
        item.options = Array.from((e as unknown as HTMLSelectElement).options).map(o => o.textContent?.trim() || o.value).filter(Boolean).slice(0, 40)
      }
      out.push(item)
      if (i >= 60) break
    }
    return out
  })
}

async function askLLM(url: string, title: string, els: Element[], history: string[]): Promise<AgentDecision> {
  const userMsg =
    `URL: ${url}\nTitel: ${title}\n` +
    (history.length ? `Recente acties: ${history.slice(-6).join(' | ')}\n` : '') +
    `Interactieve elementen:\n${JSON.stringify(els)}`

  let text = ''
  if (BACKEND === 'ollama') {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL, stream: false, format: 'json', options: { temperature: 0 },
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
      }),
    })
    const j = await res.json() as { message?: { content: string }; error?: string }
    if (j.error) throw new Error(`Ollama: ${j.error}`)
    text = j.message?.content ?? ''
  } else {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY as string, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, system: SYSTEM, messages: [{ role: 'user', content: userMsg }] }),
    })
    const j = await res.json() as { content?: { type: string; text: string }[]; error?: { message: string } }
    if (j.error) throw new Error(`Anthropic: ${j.error.message}`)
    text = (j.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('\n')
  }
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return { note: 'geen JSON', done: true }
  return JSON.parse(m[0]) as AgentDecision
}

async function execute(page: Page, act: { action: string; ref: string; value?: string }): Promise<string> {
  const loc = page.locator(`[data-agent-ref="${act.ref}"]`).first()
  const opt = { timeout: 5000 } // snel falen i.p.v. 30s hangen op niet-actionable elementen
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 2500 }).catch(() => {})
    if (act.action === 'fill') { await loc.fill(act.value ?? '', opt); return `fill ${act.ref}="${(act.value ?? '').slice(0, 30)}"` }
    if (act.action === 'select') {
      await loc.selectOption({ label: act.value ?? '' }, opt).catch(async () => { await loc.selectOption(act.value ?? '', opt) })
      return `select ${act.ref}=${act.value}`
    }
    if (act.action === 'check') { await loc.check(opt); return `check ${act.ref}` }
    if (act.action === 'click') { await loc.click(opt); return `click ${act.ref}` }
  } catch (e) { return `overslaan ${act.action} ${act.ref}: ${(e as Error).message.split('\n')[0].slice(0, 50)}` }
  return `onbekende actie ${act.action}`
}

type Target = { name: string; url: string }

/** Gerichte, nog-niet-aangemelde programma's met een echt formulier (geen e-mail/geblokkeerd). */
type Row = { name: string; url: string | null; metadata: { targeted?: { included?: boolean; grp?: string; rank?: number }; blocked?: unknown; apply?: { method?: string }; signup_pack?: { signup_url?: string } } | null }

/** Gerichte, nog-niet-aangemelde programma's via Supabase REST (geen supabase-js → werkt op Node 20). */
async function loadTargets(): Promise<Target[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('SUPABASE env ontbreekt → geef een --url mee.'); return [] }
  const q = `${SUPABASE_URL}/rest/v1/affiliate_programs?select=name,url,account_status,metadata&account_status=eq.not_started&url=not.is.null`
  const res = await fetch(q, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } })
  if (!res.ok) { console.error('Supabase REST fout:', res.status, (await res.text()).slice(0, 120)); return [] }
  const rows = await res.json() as Row[]
  return rows
    .filter(r => r.metadata?.targeted?.included === true && !r.metadata?.blocked && r.metadata?.apply?.method !== 'email')
    .sort((a, b) => {
      const ga = a.metadata?.targeted?.grp ?? '', gb = b.metadata?.targeted?.grp ?? ''
      return ga !== gb ? ga.localeCompare(gb) : (a.metadata?.targeted?.rank ?? 0) - (b.metadata?.targeted?.rank ?? 0)
    })
    .map(r => ({ name: r.name, url: r.metadata?.signup_pack?.signup_url || (r.url as string) }))
}

/** Klik gangbare cookie/consent-knoppen weg zodat het formulier bereikbaar wordt. */
async function dismissConsent(page: Page): Promise<void> {
  const sels = [
    '#onetrust-accept-btn-handler', 'button#onetrust-accept-btn-handler',
    'button:has-text("Accept all")', 'button:has-text("Accept All")',
    'button:has-text("Alles accepteren")', 'button:has-text("Accepteren")',
    'button:has-text("I Accept")', 'button:has-text("I agree")', 'button:has-text("Agree")',
    '[aria-label="Accept all"]', '.cookie button:has-text("Accept")',
  ]
  for (const s of sels) {
    try { const b = page.locator(s).first(); if (await b.count() && await b.isVisible()) { await b.click({ timeout: 2000 }); return } } catch { /* volgende */ }
  }
}

/** Doorloop één formulier (meerstaps) tot klaar / mens-stop. */
async function runForm(page: Page, rl: readline.Interface): Promise<'quit' | 'done'> {
  const history: string[] = []
  let stale = 0
  for (let step = 1; step <= MAX_STEPS; step++) {
    await page.waitForTimeout(1200)
    await dismissConsent(page)
    const els = await snapshot(page)
    const url = page.url(); const title = await page.title().catch(() => '')
    console.log(`  ── stap ${step} · ${title || url}`)
    let decision: AgentDecision
    try { decision = await askLLM(url, title, els, history) }
    catch (e) { console.error('    LLM-fout:', (e as Error).message); return 'done' }
    if (decision.note) console.log(`    agent: ${decision.note}`)

    if (decision.human) {
      const submitGate = /verzend|submit|bevestig/i.test(decision.human)
      if (AUTO_SUBMIT && submitGate) {
        const submit = page.locator('button[type=submit], button:has-text("Submit"), button:has-text("Apply"), button:has-text("Register"), button:has-text("Create"), button:has-text("Sign up")').first()
        await submit.click({ timeout: 5000 }).catch(() => {})
        console.log('    → finale knop geklikt (AUTO_SUBMIT)')
        return 'done'
      }
      const ans = (await rl.question(`    ⏸  ${decision.human}\n    Los op in Chrome → [Enter]=verder · s=skip programma · q=stop > `)).trim().toLowerCase()
      if (ans === 'q') return 'quit'
      if (ans === 's' || submitGate) return 'done'
      stale = 0; continue
    }
    if (decision.done) return 'done'

    const acts = decision.actions ?? []
    let ok = 0
    for (const act of acts) {
      const r = await execute(page, act)
      console.log(`    · ${r}`)
      history.push(r)
      if (!/^(overslaan|FOUT|onbekende)/.test(r)) ok++
      await page.waitForTimeout(300)
    }
    if (history.length > 12) history.splice(0, history.length - 12)

    // Geen voortgang (geen acties, of alles faalde) → na 3× het programma overslaan.
    if (acts.length === 0 || ok === 0) stale++; else stale = 0
    if (stale >= 3) { console.log('    ⚠ geen voortgang (3×) → programma overgeslagen.'); return 'done' }
  }
  return 'done'
}

async function main() {
  const urlArg = process.argv.indexOf('--url')
  const startUrl = urlArg >= 0 ? process.argv[urlArg + 1] : null

  let page: Page, cleanup: () => Promise<void>
  try {
    const browser = await chromium.connectOverCDP(CDP_URL)
    const context: BrowserContext = browser.contexts()[0] ?? await browser.newContext()
    page = context.pages().find(p => !p.url().startsWith('chrome')) ?? await context.newPage()
    cleanup = async () => { await browser.close().catch(() => {}) }
    console.log(`Aangehaakt aan jouw Chrome via CDP ✓  (brein: ${BACKEND} · ${MODEL})\n`)
  } catch {
    console.error(`Geen Chrome met debug-poort op ${CDP_URL}. Start eerst: bash scripts/launch-chrome-autofill.sh`)
    process.exit(1)
  }

  const rl = readline.createInterface({ input, output })
  try {
    const targets: Target[] = startUrl ? [{ name: 'handmatig', url: startUrl }] : await loadTargets()
    if (!targets.length) { console.log('Geen aanmeld-doelen gevonden.'); return }
    console.log(`Aanmeld-lijst: ${targets.length} programma's\n`)
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]
      console.log(`\n════ [${i + 1}/${targets.length}] ${t.name}\n      ${t.url}`)
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => console.log('      ⚠ navigeren traag/mislukt — los in Chrome op'))
      const r = await runForm(page, rl)
      if (r === 'quit') { console.log('\nGestopt door gebruiker.'); break }
      console.log(`  ✓ ${t.name} afgerond/overgeslagen`)
    }
  } finally {
    rl.close()
    await cleanup()
  }
  console.log('\nAgent gestopt.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
