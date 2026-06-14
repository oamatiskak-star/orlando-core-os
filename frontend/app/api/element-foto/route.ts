import { NextRequest, NextResponse } from 'next/server'

const COMBI_COLORS: Record<string, { c1: string; c2: string; accent: string }> = {
  'Sloopwerk':             { c1: '#450a0a', c2: '#991b1b', accent: '#f87171' },
  'Fundering & Grondwerk': { c1: '#1c0a02', c2: '#92400e', accent: '#fbbf24' },
  'Metselwerk':            { c1: '#431407', c2: '#9a3412', accent: '#fb923c' },
  'Betonwerk':             { c1: '#1c1917', c2: '#44403c', accent: '#a8a29e' },
  'Riolering':             { c1: '#0c1a25', c2: '#1e3a5f', accent: '#60a5fa' },
  'Asbestsanering':        { c1: '#1a0533', c2: '#5b21b6', accent: '#a78bfa' },
  'Dakwerk':               { c1: '#0c1a3d', c2: '#1e3a8a', accent: '#93c5fd' },
  'Dakkapel & Dakraam':    { c1: '#0c2340', c2: '#1d4ed8', accent: '#7dd3fc' },
  'Isolatie':              { c1: '#052e16', c2: '#15803d', accent: '#4ade80' },
  'Gevelrenovatie':        { c1: '#29200d', c2: '#92400e', accent: '#fcd34d' },
  'Kozijnen & Deuren':     { c1: '#1c2b1a', c2: '#166534', accent: '#86efac' },
  'Stucwerk & Plafonds':   { c1: '#1e2027', c2: '#374151', accent: '#d1d5db' },
  'Tegelwerk':             { c1: '#0f172a', c2: '#1e40af', accent: '#7dd3fc' },
  'Vloerwerk':             { c1: '#1c1409', c2: '#78350f', accent: '#d97706' },
  'Schilderwerk':          { c1: '#1a1040', c2: '#4c1d95', accent: '#c4b5fd' },
  'Timmerwerk':            { c1: '#1c1409', c2: '#713f12', accent: '#ca8a04' },
  'Elektra':               { c1: '#1a1200', c2: '#713f12', accent: '#fde047' },
  'Loodgieterij':          { c1: '#0c1a3d', c2: '#1e3a8a', accent: '#22d3ee' },
  'CV-installatie':        { c1: '#200f0f', c2: '#7f1d1d', accent: '#fca5a5' },
  'Ventilatie & WTW':      { c1: '#0d2030', c2: '#0c4a6e', accent: '#38bdf8' },
  'Zonnepanelen':          { c1: '#052e16', c2: '#14532d', accent: '#86efac' },
  'Badkamer compleet':     { c1: '#0c1a3d', c2: '#164e63', accent: '#67e8f9' },
  'Keukenplaatsing':       { c1: '#1a0533', c2: '#6b21a8', accent: '#e879f9' },
  'Trap & Balustrade':     { c1: '#1c1409', c2: '#44403c', accent: '#d6d3d1' },
  'Bestrating & Terras':   { c1: '#1c1917', c2: '#3f3f46', accent: '#a1a1aa' },
  'Tuinafscheiding':       { c1: '#052e16', c2: '#14532d', accent: '#86efac' },
}

function wrap(s: string, maxLen: number): string[] {
  const words = s.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxLen && cur) {
      lines.push(cur.trim())
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function elementSvg(omschrijving: string, combi: string): string {
  const col = COMBI_COLORS[combi] ?? { c1: '#0f172a', c2: '#334155', accent: '#94a3b8' }
  const lines = wrap(omschrijving, 18)
  const startY = lines.length === 1 ? 108 : 98
  const lineH = 14
  const textLines = lines
    .map((l, i) => `<text x="100" y="${startY + i * lineH}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${lines.length > 1 ? 11 : 12}" font-weight="600" fill="white" opacity="0.92">${l.replace(/&/g, '&amp;')}</text>`)
    .join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${col.c1}"/>
      <stop offset="100%" stop-color="${col.c2}"/>
    </linearGradient>
    <pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.6"/>
    </pattern>
    <linearGradient id="over" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="1.5"/></filter>
  </defs>
  <rect width="200" height="140" fill="url(#bg)"/>
  <rect width="200" height="140" fill="url(#p)"/>
  <circle cx="40" cy="35" r="80" fill="${col.accent}" opacity="0.08" filter="url(#blur)"/>
  <circle cx="170" cy="110" r="60" fill="${col.accent}" opacity="0.06" filter="url(#blur)"/>
  <rect width="200" height="140" fill="url(#over)"/>
  <rect x="10" y="118" width="28" height="2.5" rx="1.25" fill="${col.accent}" opacity="0.85"/>
  ${textLines}
</svg>`
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const combi = req.nextUrl.searchParams.get('combi') ?? ''
  const omschrijving = slug.replace(/-/g, ' ')
  const svg = elementSvg(omschrijving, combi)
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
