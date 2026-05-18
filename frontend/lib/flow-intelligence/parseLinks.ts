// Extract outgoing navigatie-refs uit .tsx/.ts bestanden.
//
// Detecteert:
//   - <Link href="/...">
//   - <Link href={`/...`}>          (template string, basic case)
//   - <a href="/...">                (alleen interne paden)
//   - router.push('/...')
//   - router.replace('/...')
//   - redirect('/...')               (next/navigation)
//
// Regex-gebaseerd om dep-vrij te blijven. Externe http(s)-URLs worden
// genegeerd. Mailto/tel: ook negeren.

import fs from 'node:fs/promises'

export interface OutgoingRef {
  href:    string
  kind:    'link' | 'anchor' | 'router-push' | 'router-replace' | 'redirect'
  file:    string
  line:    number
}

const PATTERNS: Array<[RegExp, OutgoingRef['kind']]> = [
  [/<Link[^>]*?\shref=(?:["']([^"']+)["']|\{[`'"]([^`'"]+)[`'"]\})/g, 'link'],
  [/<a[^>]*?\shref=(?:["']([^"']+)["'])/g, 'anchor'],
  [/router\.push\(\s*[`'"]([^`'"]+)[`'"]/g, 'router-push'],
  [/router\.replace\(\s*[`'"]([^`'"]+)[`'"]/g, 'router-replace'],
  [/\bredirect\(\s*[`'"]([^`'"]+)[`'"]/g, 'redirect'],
]

function lineOf(text: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++
  }
  return line
}

function isInternalRoute(href: string): boolean {
  if (!href) return false
  if (href.startsWith('/')) return true
  if (/^(https?:)?\/\//i.test(href)) return false
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return false
  if (href.startsWith('#')) return false
  // Relatieve paden uit ../ → niet toepasbaar zonder context — skip
  return false
}

export async function parseLinks(file: string): Promise<OutgoingRef[]> {
  let text: string
  try {
    text = await fs.readFile(file, 'utf8')
  } catch {
    return []
  }

  const out: OutgoingRef[] = []
  for (const [re, kind] of PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const href = m[1] ?? m[2]
      if (!href || !isInternalRoute(href)) continue
      out.push({ href, kind, file, line: lineOf(text, m.index) })
    }
  }
  return out
}
