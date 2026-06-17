/**
 * SCRIPT-CLEAN (Content Factory 2.0 — content-kwaliteit).
 *
 * Eén bron voor het strippen van regie-aanwijzingen/markdown uit een LLM-script
 * vóór TTS én vóór on-screen captions. Het LLM lekt regelmatig structuur in de
 * tekst ("(0:00-0:20) HOOK", **vet**, ## kop, [bron], bullets) — die mag NOOIT
 * uitgesproken worden of in beeld verschijnen. Daarnaast: caption-helpers voor
 * korte, leesbare news-lower-third regels (wat de stem zegt, op het scherm).
 *
 * Alle functies zijn idempotent (twee keer draaien = zelfde resultaat) en
 * verzinnen NOOIT nieuwe content — ze verwijderen alleen ruis en herformatteren.
 */

// Regie-trefwoorden binnen haakjes: (pause), (b-roll: x), (music swells), (cut to ...).
const DIRECTION_WORDS = '(?:pause|beat|cut|b-?roll|music|sfx|sound|visual|on[ -]?screen|' +
  'show|cue|transition|fade|hook|intro|outro|narrator|voice ?over|vo|chart|graphic|overlay|' +
  'pauze|muziek|beeld|geluid|overgang)'
const PAREN_DIRECTION = new RegExp(`\\((?:[^)]*\\b${DIRECTION_WORDS}\\b[^)]*)\\)`, 'gi')

// Sectielabels aan regelbegin: HOOK: / DATA BEAT 1: / TWIST / CONCLUSIE / CTA / SECTION 2 / STAP 3.
const SECTION_LABEL = /^[ \t]*(?:HOOK|CONTEXT|DATA[ _]?BEAT(?:\s*\d+)?|TWIST|CONCLUSION|CONCLUSIE|CTA|INTRO|OUTRO|SECTION(?:\s*\d+)?|PART\s*\d+|SCENE\s*\d+|STAP\s*\d+|DEEL\s*\d+)\b[ \t]*[:\-—.]*[ \t]*/gim

/**
 * Maakt een script schoon voor TTS én captions: verwijdert markdown, timecodes,
 * sectielabels, regie-haakjes en lijst-markers; geeft vloeiend proza terug
 * (regeleindes → spaties) zodat de TTS-zin-chunker correct op leestekens splitst.
 */
export function cleanForSpeech(raw: string): string {
  if (!raw) return ''
  let s = String(raw).replace(/\r\n?/g, '\n')

  // markdown links [tekst](url) → tekst
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // overige [..]: bron/regie (bevat ':' of regie-/bron-trefwoord) → weg; anders inhoud behouden
  s = s.replace(/\[([^\]]*)\]/g, (_m, inner: string) =>
    (/:|source|bron|https?:|www\.|\b(?:cut|b-?roll|chart|graphic|visual|on[ -]?screen|overlay|footage)\b/i.test(inner) ? ' ' : inner))

  // markdown koppen + nadruk/code-markers
  s = s.replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
  s = s.replace(/[*_`]{1,3}/g, '')

  // timecodes: (0:00-0:20), (0:00 - 0:20), losse "0:00 -" aan regelbegin
  s = s.replace(/\(\s*\d{1,2}:\d{2}\s*(?:[-–—]\s*\d{1,2}:\d{2}\s*)?\)/g, ' ')
  s = s.replace(/^[ \t]*\d{1,2}:\d{2}\s*[-–—]?\s*/gm, '')

  // regie-haakjes en sectielabels
  s = s.replace(PAREN_DIRECTION, ' ')
  s = s.replace(SECTION_LABEL, '')

  // lijst-/bullet-markers aan regelbegin (ook en-dash – / em-dash —)
  s = s.replace(/^[ \t]*(?:[-–—•*]|\d+[.)])[ \t]+/gm, '')

  // witruimte normaliseren → proza
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/ *\n+ */g, ' ')
  s = s.replace(/\s+([,.;:!?])/g, '$1')   // geen spatie vóór leesteken
  s = s.replace(/\(\s*\)/g, ' ')          // lege haakjes-resten
  s = s.replace(/\s{2,}/g, ' ')
  return s.trim()
}

/** Lichte titel-opschoning: strip markdown/labels maar behoud de inhoud (voor SEO-titel + titelbalk). */
export function cleanTitle(raw: string): string {
  if (!raw) return ''
  return String(raw)
    .replace(/[*_`#]/g, '')
    .replace(SECTION_LABEL, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Beperkt tekst tot de eerste `maxWords` woorden zonder een woord af te kappen (caption-lengte). */
export function softCapWords(text: string, maxWords: number): string {
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return words.slice(0, maxWords).join(' ').replace(/[,;:]$/, '')
}

/**
 * Caption uit gesproken tekst: schoon + tot een leesbare lower-third-lengte beperkt.
 * Toont WAT DE STEM ZEGT (news-presentator), geen los 6-woord-label.
 */
export function captionFromText(raw: string, maxWords = 26): string {
  return softCapWords(cleanForSpeech(raw), maxWords)
}

/**
 * Greedy word-wrap naar regels van max `maxChars` tekens, hard begrensd op `maxLines`.
 * Bij afkappen krijgt de laatste regel een ellipsis — voorkomt overflow buiten beeld.
 */
export function wrapCaptionLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let cur = ''
  let used = 0
  for (const w of words) {
    if (!cur) { cur = w; used++; continue }
    if ((cur.length + 1 + w.length) <= maxChars) { cur += ' ' + w; used++ }
    else {
      lines.push(cur)
      if (lines.length === maxLines) { cur = ''; break }
      cur = w; used++
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  if (lines.length === maxLines && used < words.length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:]?$/, '') + '…'
  }
  return lines
}
