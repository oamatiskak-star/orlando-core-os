/**
 * Affiliate Auto-Fill — generieke formulier-invuller voor ALLE affiliate-signups.
 *
 * Geen per-programma field-maps en geen screenshots: dit opent een ECHTE Chrome
 * (channel:'chrome', zonder automation-vlaggen → Cloudflare is oplosbaar) met een
 * persistent profiel, loopt door de signup-URL's, en vult op elke pagina de velden
 * die het herkent op basis van label/name/placeholder/aria-label. Daarna pauzeert
 * het voor jou: jij doet captcha + checkt + klikt submit → Enter → volgende.
 *
 * Interactief (foreground CLI), NIET als PM2-service. Draaien:
 *   cd local-agent && npx ts-node --transpile-only src/affiliate-autofill.ts          # alleen 'ready' programma's
 *   cd local-agent && npx ts-node --transpile-only src/affiliate-autofill.ts --all     # alle met een signup-URL
 *
 * Het persistente profiel staat in ~/.orlando-browser-reg-profile, dus login +
 * Cloudflare-clearance blijven bewaard tussen runs.
 */
import 'dotenv/config'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { chromium, Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── Profiel-woordenboek (gedeeld met setup-data.ts) ─────────────────────────
const ABOUT =
  'Aquier (aquier.com) is a growing online knowledge base covering personal finance, investing, real estate, and ' +
  'small-business marketing and SEO. We publish in-depth, research-backed articles that help readers make better ' +
  'money, property, and business decisions. The site currently hosts roughly 300 articles in English and Dutch ' +
  '(Dutch-first) and is actively expanding into additional countries and languages. We are an early-stage but ' +
  'established and steadily growing publisher, operated under Modiwerijo Financial Management BV (Netherlands).'
const AUDIENCE =
  'Self-directed individuals and small-business owners interested in personal finance, investing, real estate, and ' +
  'growing a business online. A high-intent audience for finance, productivity, SaaS, marketing and SEO products. ' +
  'Primarily Dutch and English-speaking, NL-first, expanding internationally.'
const PROMOTION =
  'Content and SEO only: long-form articles, product reviews, comparison and round-up content, and an email newsletter, ' +
  'all built around organic search and genuine editorial recommendations. We embed partner links contextually within ' +
  'relevant content. No brand-keyword bidding, no incentivized/coupon traffic. Every placement is editorial and disclosed.'

const PROFILE: Record<string, string> = {
  firstName: 'Orlando',
  lastName: 'Amatiskak',
  fullName: 'Orlando Amatiskak',
  email: 'o.amatiskak@gmail.com',
  website: 'https://aquier.com',
  company: 'Modiwerijo Financial Management BV',
  country: 'Netherlands',
  city: 'Rotterdam',
  kvk: '97494380',
  vat: 'NL868076314B01',
  about: ABOUT,
  audience: AUDIENCE,
  promotion: PROMOTION,
}

// ── Match-regels (volgorde = prioriteit; eerste match wint) ─────────────────
type Rule = { test: RegExp; key: keyof typeof PROFILE; selectValue?: string }
const RULES: Rule[] = [
  { test: /(vat|btw|tax\s*id)/i, key: 'vat' },
  { test: /(kvk|chamber|coc|registration\s*number|company\s*number)/i, key: 'kvk' },
  { test: /(e-?mail)/i, key: 'email' },
  { test: /(pay\s*pal)/i, key: 'email' },
  { test: /(website|web\s*site|url|your\s*site|domain|blog\s*url|site\s*url)/i, key: 'website' },
  { test: /(first\s*name|voornaam|given\s*name)/i, key: 'firstName' },
  { test: /(last\s*name|surname|achternaam|family\s*name)/i, key: 'lastName' },
  { test: /(company|business\s*name|organi[sz]ation|brand\s*name|legal\s*name)/i, key: 'company' },
  { test: /(country|land|region)/i, key: 'country', selectValue: 'Netherlands' },
  { test: /(city|plaats|town)/i, key: 'city' },
  { test: /(describe|about\s*you|about\s*your|tell\s*us|bio|business\s*description|company\s*description)/i, key: 'about' },
  { test: /(audience|who\s*(do|are)\s*you|your\s*(customers|users|readers)|target\s*market|who\s*you\s*sell)/i, key: 'audience' },
  { test: /(promot|how\s*(do|will)\s*you|marketing\s*(method|channel)|traffic\s*source|channels?)/i, key: 'promotion' },
  { test: /(full\s*name|your\s*name|name)/i, key: 'fullName' }, // laatste: generieke 'name' pas als niets specifieker matchte
]

type FieldDescriptor = { idx: number; tag: string; type: string; label: string }

/** Lees alle zichtbare, lege, bewerkbare velden + hun semantische label uit de pagina. */
async function scanFields(page: Page): Promise<FieldDescriptor[]> {
  return page.evaluate(() => {
    function labelText(el: Element): string {
      let t = ''
      const id = (el as HTMLElement).id
      if (id) {
        const l = document.querySelector(`label[for="${CSS.escape(id)}"]`)
        if (l) t += ' ' + (l.textContent || '')
      }
      const aria = el.getAttribute('aria-label'); if (aria) t += ' ' + aria
      const ph = el.getAttribute('placeholder'); if (ph) t += ' ' + ph
      const nm = el.getAttribute('name'); if (nm) t += ' ' + nm
      const lab = el.closest('label'); if (lab) t += ' ' + (lab.textContent || '')
      return t.toLowerCase().replace(/\s+/g, ' ').trim()
    }
    const skip = ['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'image', 'password', 'search']
    const out: { idx: number; tag: string; type: string; label: string }[] = []
    let i = 0
    for (const el of Array.from(document.querySelectorAll('input, textarea, select'))) {
      const e = el as HTMLInputElement
      const type = (e.getAttribute('type') || e.tagName).toLowerCase()
      if (skip.includes(type)) continue
      const style = getComputedStyle(e)
      if (style.display === 'none' || style.visibility === 'hidden' || e.disabled || (e as HTMLInputElement).readOnly) continue
      if (e.offsetParent === null && style.position !== 'fixed') continue
      if ((e as HTMLInputElement).value && String((e as HTMLInputElement).value).trim()) continue // al gevuld
      e.setAttribute('data-afill', String(i))
      out.push({ idx: i, tag: e.tagName.toLowerCase(), type, label: labelText(e) })
      i++
    }
    return out
  })
}

function pickRule(label: string): Rule | null {
  for (const r of RULES) if (r.test.test(label)) return r
  return null
}

/** Vul één pagina; geeft terug wat er gevuld is. */
async function fillPage(page: Page): Promise<{ filled: string[]; unmatched: number }> {
  const fields = await scanFields(page)
  const filled: string[] = []
  let unmatched = 0
  for (const f of fields) {
    const rule = pickRule(f.label)
    if (!rule) { unmatched++; continue }
    const value = PROFILE[rule.key]
    const loc = page.locator(`[data-afill="${f.idx}"]`).first()
    try {
      if (f.tag === 'select') {
        const target = rule.selectValue ?? value
        await loc.selectOption({ label: target }).catch(async () => {
          await loc.selectOption(target).catch(() => {})
        })
      } else {
        await loc.fill(value)
      }
      filled.push(`${rule.key} → "${(f.label || f.type).slice(0, 40)}"`)
    } catch { /* veld weigerde — sla over, mens kan het zelf doen */ }
  }
  return { filled, unmatched }
}

async function loadTargets(all: boolean): Promise<{ name: string; url: string }[]> {
  const { data } = await db
    .from('affiliate_programs')
    .select('name, url, metadata')
    .not('url', 'is', null)
    .order('name', { ascending: true })
  const rows = (data ?? []) as { name: string; url: string | null; metadata: Record<string, unknown> | null }[]
  const out: { name: string; url: string }[] = []
  for (const r of rows) {
    const pack = (r.metadata?.signup_pack ?? {}) as { ready?: boolean; signup_url?: string }
    if (!all && pack.ready !== true) continue
    const url = pack.signup_url || r.url
    if (url) out.push({ name: r.name, url })
  }
  return out
}

async function main() {
  const all = process.argv.includes('--all')
  const targets = await loadTargets(all)
  if (!targets.length) { console.log('Geen signup-URL’s gevonden.'); return }

  console.log(`\n  Affiliate Auto-Fill — ${targets.length} programma’s (${all ? 'alle' : 'ready'})`)
  console.log('  Echte Chrome, persistent profiel. Per formulier: ik vul, jij checkt + submit.\n')

  // Primair: hang aan JOUW handmatig-gestarte Chrome via CDP (debug-poort). Een
  // zo gestarte Chrome zet GEEN navigator.webdriver → Cloudflare laat je door, en
  // je eigen logins/sessies zijn beschikbaar. Terugval: een eigen Chrome-profiel.
  const CDP_URL = process.env.BROWSER_REG_CDP_URL ?? 'http://127.0.0.1:9222'
  let page: Page
  let cleanup: () => Promise<void>
  try {
    const browser = await chromium.connectOverCDP(CDP_URL)
    const ctx = browser.contexts()[0] ?? await browser.newContext()
    page = await ctx.newPage() // nieuwe tab in JOUW Chrome
    cleanup = async () => { await browser.close().catch(() => {}) } // close() = alleen loskoppelen; jouw Chrome blijft open
    console.log(`Aangehaakt aan jouw Chrome via CDP (${CDP_URL}) ✓\n`)
  } catch {
    console.log(`Geen Chrome met debug-poort op ${CDP_URL}. Start Chrome eerst met de debug-poort`)
    console.log('(zie instructie), of druk Enter om terug te vallen op een apart Chrome-profiel.\n')
    const userDataDir = process.env.BROWSER_REG_PROFILE_DIR
      ?? `${process.env.HOME ?? '/tmp'}/.orlando-browser-reg-profile`
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    })
    page = ctx.pages()[0] ?? await ctx.newPage()
    cleanup = async () => { await ctx.close().catch(() => {}) }
  }
  const rl = readline.createInterface({ input, output })

  try {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]
      console.log(`\n── [${i + 1}/${targets.length}] ${t.name}`)
      console.log(`   ${t.url}`)
      try {
        await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      } catch { console.log('   ⚠ navigeren mislukte/traag — los het in het venster op.') }

      // korte settle voor SPA's, dan vullen
      await page.waitForTimeout(1500)
      const { filled, unmatched } = await fillPage(page)
      if (filled.length) { console.log(`   ✓ ingevuld: ${filled.length} veld(en)`); filled.forEach(f => console.log(`     · ${f}`)) }
      else console.log('   (niets herkend op deze pagina — log in / klik door, dan opnieuw vullen met "f")')
      if (unmatched) console.log(`   ${unmatched} niet-herkend veld(en) → zelf doen`)

      const ans = (await rl.question('   [Enter]=volgende · f=opnieuw vullen · s=skip · q=stop > ')).trim().toLowerCase()
      if (ans === 'q') break
      if (ans === 's') continue
      if (ans === 'f') { i--; continue } // zelfde pagina opnieuw scannen (na login/doorklikken)
    }
  } finally {
    rl.close()
    await cleanup()
  }
  console.log('\nKlaar.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
