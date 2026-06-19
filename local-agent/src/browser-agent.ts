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
  phone: '(ONBEKEND — vraag de mens)',
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
- Niets meer te doen op deze pagina en geen knop om door te gaan: {"actions":[],"done":true}.`

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

async function main() {
  const urlArg = process.argv.indexOf('--url')
  const startUrl = urlArg >= 0 ? process.argv[urlArg + 1] : null

  let context: BrowserContext, page: Page, cleanup: () => Promise<void>
  try {
    const browser = await chromium.connectOverCDP(CDP_URL)
    context = browser.contexts()[0] ?? await browser.newContext()
    page = context.pages().find(p => !p.url().startsWith('chrome')) ?? await context.newPage()
    cleanup = async () => { await browser.close().catch(() => {}) }
    console.log(`Aangehaakt aan jouw Chrome via CDP ✓  (brein: ${BACKEND} · ${MODEL})\n`)
  } catch {
    console.error(`Geen Chrome met debug-poort op ${CDP_URL}. Start eerst: bash scripts/launch-chrome-autofill.sh`)
    process.exit(1)
  }

  const rl = readline.createInterface({ input, output })
  if (startUrl) { await page.goto(startUrl, { waitUntil: 'domcontentloaded' }).catch(() => {}) }

  try {
    for (let step = 1; step <= MAX_STEPS; step++) {
      await page.waitForTimeout(1200)
      const els = await snapshot(page)
      const url = page.url(); const title = await page.title().catch(() => '')
      console.log(`\n── stap ${step} · ${title || url}`)
      const history: string[] = []
      let decision: AgentDecision
      try { decision = await askLLM(url, title, els, history) }
      catch (e) { console.error('  LLM-fout:', (e as Error).message); break }

      if (decision.note) console.log(`  agent: ${decision.note}`)

      if (decision.human) {
        const ans = (await rl.question(`  ⏸  ${decision.human}\n  Los het in Chrome op, dan [Enter]=verder · s=skip-pagina · q=stop > `)).trim().toLowerCase()
        if (ans === 'q') break
        if (ans === 's') { await page.waitForTimeout(500); continue }
        // bij "klaar om te verzenden": optioneel zelf de finale knop klikken
        if (AUTO_SUBMIT && /verzend|submit/i.test(decision.human)) {
          const submit = page.locator('button[type=submit], button:has-text("Submit"), button:has-text("Apply"), button:has-text("Register"), button:has-text("Create")').first()
          await submit.click().catch(() => {})
          console.log('  → finale knop geklikt (AUTO_SUBMIT)')
        }
        continue
      }

      if (decision.done) { console.log('  ✓ agent: pagina klaar.');
        const ans = (await rl.question('  [Enter]=volgende stap/pagina · q=stop > ')).trim().toLowerCase()
        if (ans === 'q') break; else continue
      }

      for (const act of decision.actions ?? []) {
        const r = await execute(page, act)
        console.log(`  · ${r}`)
        await page.waitForTimeout(300)
      }
    }
  } finally {
    rl.close()
    await cleanup()
  }
  console.log('\nAgent gestopt.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
