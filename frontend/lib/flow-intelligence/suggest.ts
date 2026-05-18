// Categoriseer nieuwe routes en stel sidebar-plaatsing voor.
// Output past in payload van orchestrator_events.

import type { RouteNode } from './scanRoutes'

export interface NavSuggestion {
  route:           string
  suggested_label: string
  suggested_key:   string
  category:        string         // bv. 'YouTube', 'Mail', 'Finance'
  section_hint:    string         // welke nav-sectie aanvullen
  confidence:      'high' | 'medium' | 'low'
}

const CATEGORY_RULES: Array<{
  test:     (route: string) => boolean
  category: string
  section:  string
}> = [
  { test: (r) => r.startsWith('/dashboard/youtube'),       category: 'YouTube',     section: 'YouTube'      },
  { test: (r) => r.startsWith('/dashboard/mail'),          category: 'Mail',        section: 'Mail Engine'  },
  { test: (r) => r.startsWith('/dashboard/finance'),       category: 'Finance',     section: 'Finance'      },
  { test: (r) => r.startsWith('/dashboard/financien'),     category: 'Finance',     section: 'Finance'      },
  { test: (r) => r.startsWith('/dashboard/vastgoed'),      category: 'Vastgoed',    section: 'Vastgoed'     },
  { test: (r) => r.startsWith('/dashboard/calculaties'),   category: 'Calculatie',  section: 'Vastgoed'     },
  { test: (r) => r.startsWith('/dashboard/bouwplaats'),    category: 'Bouw',        section: 'Bouw'         },
  { test: (r) => r.startsWith('/dashboard/personeel'),     category: 'Personeel',   section: 'Personeel'    },
  { test: (r) => r.startsWith('/dashboard/advocaat'),      category: 'Juridisch',   section: 'Juridisch'    },
  { test: (r) => r.startsWith('/dashboard/ai-advocaat'),   category: 'Juridisch',   section: 'Juridisch'    },
  { test: (r) => r.startsWith('/dashboard/osil'),          category: 'OSIL',        section: 'OSIL'         },
  { test: (r) => r.startsWith('/dashboard/agents'),        category: 'AI',          section: 'AI & Workflow'},
  { test: (r) => r.startsWith('/dashboard/workflows'),     category: 'AI',          section: 'AI & Workflow'},
  { test: (r) => r.startsWith('/dashboard/orchestrator'),  category: 'AI',          section: 'AI & Workflow'},
  { test: (r) => r.startsWith('/dashboard/admin'),         category: 'Admin',       section: 'Systeem'      },
  { test: (r) => r.startsWith('/dashboard/instellingen'),  category: 'Admin',       section: 'Systeem'      },
]

function lastSegment(route: string): string {
  const parts = route.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

function toLabel(seg: string): string {
  return seg
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function toKey(route: string): string {
  return route
    .replace(/^\/dashboard\//, '')
    .replace(/\//g, '_')
    .replace(/[^a-z0-9_]/gi, '')
    .toLowerCase()
}

export function suggestForNewRoute(node: RouteNode): NavSuggestion | null {
  if (!node.route.startsWith('/dashboard/')) return null
  if (node.dynamic) return null
  if (node.depth !== 2) return null // alleen top-level dashboard children

  const seg = lastSegment(node.route)
  if (!seg) return null

  const rule = CATEGORY_RULES.find((r) => r.test(node.route))
  return {
    route:           node.route,
    suggested_label: toLabel(seg),
    suggested_key:   toKey(node.route),
    category:        rule?.category ?? 'Overig',
    section_hint:    rule?.section  ?? 'Overig',
    confidence:      rule ? 'medium' : 'low',
  }
}

export function buildNavSuggestions(nodes: RouteNode[], navHrefs: Set<string>): NavSuggestion[] {
  const out: NavSuggestion[] = []
  for (const n of nodes) {
    if (navHrefs.has(n.route)) continue
    const s = suggestForNewRoute(n)
    if (s) out.push(s)
  }
  return out
}
