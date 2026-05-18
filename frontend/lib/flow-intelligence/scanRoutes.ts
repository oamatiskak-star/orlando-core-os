// Walk Next.js `app/` tree → derive route paths from page.tsx files.
//
// Regels:
//   - app/foo/page.tsx       → /foo
//   - app/foo/[id]/page.tsx  → /foo/[id]
//   - app/(group)/x/page.tsx → /x   (route groups uitsluiten)
//   - alleen .tsx / .ts pages

import fs from 'node:fs/promises'
import path from 'node:path'

export interface RouteNode {
  route:    string        // bv. /dashboard/orchestrator
  file:     string        // absoluut pad naar page.tsx
  depth:    number        // aantal segmenten
  dynamic:  boolean       // bevat [param]
  group:    string | null // (grouped)? voor categorisatie
}

const PAGE_FILES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js'])
const IGNORE_DIRS = new Set(['node_modules', '.next', '.turbo', '__tests__'])

function segmentToRoute(seg: string): string | null {
  if (seg.startsWith('(') && seg.endsWith(')')) return null // route group
  if (seg.startsWith('@')) return null                       // parallel route slot
  if (seg.startsWith('_')) return null                       // private folder
  return seg
}

export async function scanRoutes(appDir: string): Promise<RouteNode[]> {
  const results: RouteNode[] = []

  async function walk(dir: string, segments: string[]): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name)) continue
        const seg = segmentToRoute(e.name)
        const nextSegs = seg === null ? segments : [...segments, seg]
        await walk(path.join(dir, e.name), nextSegs)
      } else if (PAGE_FILES.has(e.name)) {
        const route = '/' + segments.join('/')
        results.push({
          route:   route === '/' ? '/' : route,
          file:    path.join(dir, e.name),
          depth:   segments.length,
          dynamic: segments.some((s) => s.startsWith('[')),
          group:   segments[0] ?? null,
        })
      }
    }
  }

  await walk(appDir, [])
  results.sort((a, b) => a.route.localeCompare(b.route))
  return results
}
