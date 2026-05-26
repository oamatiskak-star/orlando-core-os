// ─────────────────────────────────────────────────────────────────────────
// Account Setup Agent — gedeelde constants & deterministische helpers.
// Pure module (geen server/client imports) → bruikbaar in server components,
// server actions én client components.
//
// REGEL (no-mock): ontbrekende gegevens worden NOOIT verzonnen. Waar data
// ontbreekt tonen we exact de placeholder PLACEHOLDER ("nog invullen").
// De agent BEREIDT voor; verzenden gebeurt altijd handmatig na goedkeuring.
// ─────────────────────────────────────────────────────────────────────────

export const PLACEHOLDER = 'nog invullen'

// ── Statussen (canoniek, gedeeld met DB check-constraints) ────────────────
export type AccountStatus =
  | 'nog_te_starten'
  | 'voorbereiden'
  | 'ontbrekende_gegevens'
  | 'klaar_voor_invoer'
  | 'handmatig_ingediend'
  | 'wacht_op_goedkeuring'
  | 'actief'
  | 'afgewezen'
  | 'gepauzeerd'

export const ACCOUNT_STATUSES: { value: AccountStatus; label: string; color: string }[] = [
  { value: 'nog_te_starten',       label: 'Nog te starten',            color: 'bg-white/10 text-white/55' },
  { value: 'voorbereiden',         label: 'Voorbereiden',              color: 'bg-blue-500/15 text-blue-400' },
  { value: 'ontbrekende_gegevens', label: 'Ontbrekende gegevens',      color: 'bg-amber-500/15 text-amber-400' },
  { value: 'klaar_voor_invoer',    label: 'Klaar voor handmatige invoer', color: 'bg-violet-500/15 text-violet-400' },
  { value: 'handmatig_ingediend',  label: 'Handmatig ingediend',       color: 'bg-cyan-500/15 text-cyan-400' },
  { value: 'wacht_op_goedkeuring', label: 'Wacht op goedkeuring',      color: 'bg-indigo-500/15 text-indigo-300' },
  { value: 'actief',               label: 'Actief',                    color: 'bg-emerald-500/15 text-emerald-400' },
  { value: 'afgewezen',            label: 'Afgewezen',                 color: 'bg-red-500/15 text-red-400' },
  { value: 'gepauzeerd',           label: 'Gepauzeerd',                color: 'bg-orange-500/15 text-orange-300' },
]

export const ACCOUNT_STATUS_VALUES = ACCOUNT_STATUSES.map((s) => s.value)

export function accountStatusBadge(value: string | null | undefined) {
  return ACCOUNT_STATUSES.find((s) => s.value === value) ?? ACCOUNT_STATUSES[0]
}

// ── Keuzelijsten ──────────────────────────────────────────────────────────
export const ACCOUNT_TYPES = [
  'affiliate-account',
  'partneraccount',
  'referentieprofiel',
  'social-mediapagina',
  'platformaccount',
  'marketplace-verkoper',
  'leverancier-portaal',
] as const

export const REVENUE_MODELS = [
  'commissie',
  'CPA (per actie)',
  'CPC (per klik)',
  'CPM (per 1000 weergaven)',
  'abonnement / recurring',
  'omzetdeling',
  'vaste vergoeding',
  'advertentie-inkomsten',
] as const

export const REVENUE_CURRENCIES = ['EUR', 'USD', 'GBP'] as const

export const PAYOUT_FREQUENCIES = [
  'eenmalig',
  'wekelijks',
  'maandelijks',
  'per_kwartaal',
  'jaarlijks',
  'per_actie',
] as const

export const PAYOUT_STATUSES = ['geen', 'openstaand', 'uitbetaald', 'ingehouden'] as const

// ── Centrale bedrijfsgegevens — registratievelden ─────────────────────────
export type BusinessProfile = {
  legal_name?: string | null
  trade_name?: string | null
  kvk_number?: string | null
  vat_number?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  website?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  iban?: string | null
  business_description?: string | null
  short_pitch?: string | null
}

export const BUSINESS_FIELDS: { key: keyof BusinessProfile; label: string; required: boolean }[] = [
  { key: 'legal_name',           label: 'Juridische naam',     required: true },
  { key: 'trade_name',           label: 'Handelsnaam',         required: false },
  { key: 'kvk_number',           label: 'KvK-nummer',          required: true },
  { key: 'vat_number',           label: 'BTW-nummer',          required: false },
  { key: 'address',              label: 'Adres',               required: true },
  { key: 'postal_code',          label: 'Postcode',            required: true },
  { key: 'city',                 label: 'Plaats',              required: true },
  { key: 'country',              label: 'Land',                required: false },
  { key: 'website',              label: 'Website',             required: true },
  { key: 'contact_email',        label: 'Contact e-mail',      required: true },
  { key: 'contact_phone',        label: 'Telefoon',            required: false },
  { key: 'iban',                 label: 'IBAN',                required: false },
  { key: 'business_description', label: 'Bedrijfsomschrijving', required: true },
  { key: 'short_pitch',          label: 'Korte pitch',         required: false },
]

function empty(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === ''
}

export function val(v: unknown): string {
  return empty(v) ? PLACEHOLDER : String(v).trim()
}

/** Ontbrekende verplichte bedrijfsvelden (labels) voor registratie. */
export function computeMissingFields(profile: BusinessProfile | null | undefined): string[] {
  const p = profile ?? {}
  return BUSINESS_FIELDS.filter((f) => f.required && empty(p[f.key])).map((f) => f.label)
}

// ── Tekstgeneratie (deterministisch, op echte data) ───────────────────────
export type TaskContext = {
  taskName: string
  taskDescription?: string | null
  milestone?: string | null
  platformName?: string | null
  accountType?: string | null
  revenueModel?: string | null
}

export type GeneratedTexts = {
  business_description: string
  affiliate_application: string
  linkedin_about: string
  cta: string
}

export function generateApplicationTexts(profile: BusinessProfile | null | undefined, ctx: TaskContext): GeneratedTexts {
  const p = profile ?? {}
  const name = val(p.trade_name) !== PLACEHOLDER ? val(p.trade_name) : val(p.legal_name)
  const desc = val(p.business_description)
  const pitch = val(p.short_pitch) !== PLACEHOLDER ? val(p.short_pitch) : desc
  const website = val(p.website)
  const platform = ctx.platformName?.trim() || PLACEHOLDER
  const model = ctx.revenueModel?.trim() || PLACEHOLDER

  const business_description = `${name} — ${desc}`

  const affiliate_application = [
    `Aanvraag ${ctx.accountType?.trim() || 'account'} voor ${platform}`,
    ``,
    `Bedrijf: ${name}`,
    `KvK: ${val(p.kvk_number)}${val(p.vat_number) !== PLACEHOLDER ? ` · BTW: ${val(p.vat_number)}` : ''}`,
    `Website: ${website}`,
    ``,
    `Over ons: ${desc}`,
    ``,
    `Wij willen ons aansluiten bij ${platform} via het verdienmodel "${model}". ` +
      `Onze doelgroep en kanalen sluiten aan op dit programma; wij promoten relevante diensten ` +
      `binnen onze eigen kanalen op een transparante, merkveilige manier.`,
    ``,
    `Contact: ${val(p.contact_email)}${val(p.contact_phone) !== PLACEHOLDER ? ` · ${val(p.contact_phone)}` : ''}`,
  ].join('\n')

  const linkedin_about = [
    `${name} — ${pitch}`,
    ``,
    `${desc}`,
    website !== PLACEHOLDER ? `Meer info: ${website}` : `Website: ${PLACEHOLDER}`,
  ].join('\n')

  const cta =
    website !== PLACEHOLDER
      ? `Ontdek wat ${name} voor je kan betekenen — ${website}`
      : `Ontdek wat ${name} voor je kan betekenen — ${PLACEHOLDER}`

  return { business_description, affiliate_application, linkedin_about, cta }
}

// ── Registratie-checklist + benodigde documenten ──────────────────────────
export type ChecklistItem = { label: string; ready: boolean; note?: string }

export function buildRequiredDocuments(accountType?: string | null): string[] {
  const base = ['KvK-uittreksel', 'Identiteitsbewijs tekenbevoegde', 'Bedrijfslogo / huisstijl']
  const t = (accountType ?? '').toLowerCase()
  if (t.includes('affiliate') || t.includes('marketplace') || t.includes('leverancier')) {
    base.push('Bankgegevens / IBAN-bevestiging', 'BTW-registratiebewijs')
  }
  if (t.includes('social') || t.includes('referentie')) {
    base.push('Profielfoto / bannerbeeld', 'Linktree / kanaaloverzicht')
  }
  return base
}

export function buildChecklist(ctx: TaskContext, missingFields: string[]): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { label: `Platform bevestigen: ${ctx.platformName?.trim() || PLACEHOLDER}`, ready: !!ctx.platformName?.trim() },
    { label: `Accounttype: ${ctx.accountType?.trim() || PLACEHOLDER}`, ready: !!ctx.accountType?.trim() },
    {
      label: 'Centrale bedrijfsgegevens compleet',
      ready: missingFields.length === 0,
      note: missingFields.length ? `Ontbreekt: ${missingFields.join(', ')}` : undefined,
    },
    { label: 'Aanvraagtekst gecontroleerd & aangepast', ready: false },
    { label: 'Benodigde documenten verzameld', ready: false },
    { label: 'Registratie handmatig ingevuld op platform', ready: false },
    { label: 'Handmatig ingediend + goedkeuring vastgelegd', ready: false },
  ]
  return items
}

/** Status na voorbereiding: ontbrekende verplichte velden → ontbrekende_gegevens. */
export function deriveStatusAfterPrepare(missingFields: string[]): AccountStatus {
  return missingFields.length > 0 ? 'ontbrekende_gegevens' : 'voorbereiden'
}

// ── Verwachte maandopbrengst-normalisatie ─────────────────────────────────
export function toMonthly(amount: number | null | undefined, frequency: string | null | undefined): number {
  const a = Number(amount) || 0
  switch ((frequency ?? '').toLowerCase()) {
    case 'wekelijks':    return a * 52 / 12
    case 'maandelijks':  return a
    case 'per_kwartaal': return a / 3
    case 'jaarlijks':    return a / 12
    case 'eenmalig':     return 0
    case 'per_actie':    return 0
    default:             return a // onbekend: behandel als maandelijks
  }
}

export function fmtMoney(amount: number | null | undefined, currency = 'EUR'): string {
  const a = Number(amount)
  if (!isFinite(a)) return PLACEHOLDER
  try {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(a)
  } catch {
    return `${currency} ${Math.round(a)}`
  }
}
