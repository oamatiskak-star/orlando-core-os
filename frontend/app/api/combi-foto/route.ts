import { NextRequest, NextResponse } from 'next/server'

type Stijl = {
  c1: string
  c2: string
  accent: string
  pat: 'brick' | 'grid' | 'diagonal' | 'dots' | 'panel' | 'wave'
}

const STIJLEN: Record<string, Stijl> = {
  'Sloopwerk':             { c1: '#450a0a', c2: '#991b1b', accent: '#f87171', pat: 'diagonal' },
  'Fundering & Grondwerk': { c1: '#1c0a02', c2: '#92400e', accent: '#fbbf24', pat: 'grid' },
  'Metselwerk':            { c1: '#431407', c2: '#9a3412', accent: '#fb923c', pat: 'brick' },
  'Betonwerk':             { c1: '#1c1917', c2: '#44403c', accent: '#a8a29e', pat: 'grid' },
  'Riolering':             { c1: '#0c1a25', c2: '#1e3a5f', accent: '#60a5fa', pat: 'wave' },
  'Asbestsanering':        { c1: '#1a0533', c2: '#5b21b6', accent: '#a78bfa', pat: 'diagonal' },
  'Dakwerk':               { c1: '#0c1a3d', c2: '#1e3a8a', accent: '#93c5fd', pat: 'diagonal' },
  'Dakkapel & Dakraam':    { c1: '#0c2340', c2: '#1d4ed8', accent: '#7dd3fc', pat: 'diagonal' },
  'Isolatie':              { c1: '#052e16', c2: '#15803d', accent: '#4ade80', pat: 'dots' },
  'Gevelrenovatie':        { c1: '#29200d', c2: '#92400e', accent: '#fcd34d', pat: 'brick' },
  'Kozijnen & Deuren':     { c1: '#1c2b1a', c2: '#166534', accent: '#86efac', pat: 'grid' },
  'Stucwerk & Plafonds':   { c1: '#1e2027', c2: '#374151', accent: '#d1d5db', pat: 'dots' },
  'Tegelwerk':             { c1: '#0f172a', c2: '#1e40af', accent: '#7dd3fc', pat: 'panel' },
  'Vloerwerk':             { c1: '#1c1409', c2: '#78350f', accent: '#d97706', pat: 'diagonal' },
  'Schilderwerk':          { c1: '#1a1040', c2: '#4c1d95', accent: '#c4b5fd', pat: 'dots' },
  'Timmerwerk':            { c1: '#1c1409', c2: '#713f12', accent: '#ca8a04', pat: 'diagonal' },
  'Elektra':               { c1: '#1a1200', c2: '#713f12', accent: '#fde047', pat: 'diagonal' },
  'Loodgieterij':          { c1: '#0c1a3d', c2: '#1e3a8a', accent: '#22d3ee', pat: 'wave' },
  'CV-installatie':        { c1: '#200f0f', c2: '#7f1d1d', accent: '#fca5a5', pat: 'wave' },
  'Ventilatie & WTW':      { c1: '#0d2030', c2: '#0c4a6e', accent: '#38bdf8', pat: 'wave' },
  'Zonnepanelen':          { c1: '#052e16', c2: '#14532d', accent: '#86efac', pat: 'panel' },
  'Badkamer compleet':     { c1: '#0c1a3d', c2: '#164e63', accent: '#67e8f9', pat: 'panel' },
  'Keukenplaatsing':       { c1: '#1a0533', c2: '#6b21a8', accent: '#e879f9', pat: 'grid' },
  'Trap & Balustrade':     { c1: '#1c1409', c2: '#44403c', accent: '#d6d3d1', pat: 'diagonal' },
  'Bestrating & Terras':   { c1: '#1c1917', c2: '#3f3f46', accent: '#a1a1aa', pat: 'grid' },
  'Tuinafscheiding':       { c1: '#052e16', c2: '#14532d', accent: '#86efac', pat: 'dots' },
}

const DEFAULT_STIJL: Stijl = { c1: '#0f172a', c2: '#334155', accent: '#94a3b8', pat: 'grid' }

function patternSvg(s: Stijl): string {
  switch (s.pat) {
    case 'brick':
      return `<pattern id="p" width="60" height="30" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="60" height="15" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>
        <rect x="30" y="15" width="60" height="15" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>
        <rect x="0" y="15" width="60" height="15" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.8"/>
      </pattern>`
    case 'grid':
      return `<pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.8"/>
      </pattern>`
    case 'diagonal':
      return `<pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="24" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
      </pattern>`
    case 'dots':
      return `<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.2" fill="rgba(255,255,255,0.08)"/>
      </pattern>`
    case 'panel':
      return `<pattern id="p" width="48" height="32" patternUnits="userSpaceOnUse">
        <rect x="2" y="2" width="44" height="28" rx="2" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="0.8"/>
        <line x1="0" y1="16" x2="48" y2="16" stroke="rgba(255,255,255,0.05)" stroke-width="0.8"/>
        <line x1="24" y1="0" x2="24" y2="32" stroke="rgba(255,255,255,0.05)" stroke-width="0.8"/>
      </pattern>`
    case 'wave':
      return `<pattern id="p" width="80" height="30" patternUnits="userSpaceOnUse">
        <path d="M 0 15 C 20 5, 40 25, 80 15" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.2"/>
      </pattern>`
  }
}

function combiSvg(naam: string, s: Stijl): string {
  const escaped = naam.replace(/&/g, '&amp;')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${s.c1}"/>
      <stop offset="100%" stop-color="${s.c2}"/>
    </linearGradient>
    ${patternSvg(s)}
    <linearGradient id="over" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="60%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.72"/>
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect width="640" height="400" fill="url(#p)"/>
  <circle cx="130" cy="110" r="220" fill="${s.accent}" opacity="0.07" filter="url(#blur)"/>
  <circle cx="530" cy="320" r="160" fill="${s.accent}" opacity="0.06" filter="url(#blur)"/>
  <rect width="640" height="400" fill="url(#over)"/>
  <rect x="32" y="342" width="52" height="3.5" rx="1.75" fill="${s.accent}" opacity="0.9"/>
  <text x="32" y="378" font-family="system-ui,-apple-system,sans-serif" font-size="26" font-weight="700" fill="white" opacity="0.95">${escaped}</text>
  <text x="32" y="328" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="500" letter-spacing="2" fill="${s.accent}" opacity="0.8">BOUW CALCULATOR</text>
</svg>`
}

export async function GET(req: NextRequest) {
  const naam = req.nextUrl.searchParams.get('naam') ?? ''
  const s = STIJLEN[naam] ?? DEFAULT_STIJL
  const svg = combiSvg(naam || 'Combi', s)
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
