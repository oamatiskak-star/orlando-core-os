// ─────────────────────────────────────────────────────────────────────────────
// VOLGLIJST — concurrent YouTube-kanalen die de lokale scraper dagelijks volgt.
// De scraper resolvet elke handle naar een channel-ID (resolveChannelHandle) en
// voegt 'm toe aan competitor_channels als hij er nog niet staat. Niet-resolvbare
// handles worden veilig overgeslagen en gelogd.
//
// CUREER DEZE LIJST: vul je echte NL finance/vastgoed/crypto-concurrenten aan.
// handle mag @handle of een kale UC...-channel-ID zijn.
// niche/language zijn vrije labels voor segmentatie op het dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export interface FollowEntry {
  handle: string
  niche: string
  language?: string
}

export const FOLLOW_LIST: FollowEntry[] = [
  // ── Voorbeelden (vervang/uitbreiden door Orlando) ──
  { handle: '@Beurswatch',        niche: 'beleggen',  language: 'nl' },
  { handle: '@meusenl',           niche: 'beleggen',  language: 'nl' },
  { handle: '@BankjeBijbeleggen', niche: 'beleggen',  language: 'nl' },
  // { handle: '@<vastgoed-concurrent>', niche: 'vastgoed', language: 'nl' },
  // { handle: '@<crypto-concurrent>',   niche: 'crypto',   language: 'nl' },
  // { handle: 'UCxxxxxxxxxxxxxxxxxxxxxx', niche: 'sparen',  language: 'nl' },
]
