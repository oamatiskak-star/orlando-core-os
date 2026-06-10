// Media War Room — Hermes-aanbeveling categorisering (gedeeld door node-chip + Hermes-tab).
// Categorie wordt afgeleid uit action_kind (classificatie, geen verzonnen data).
// Bron: public.executive_recommendations.

export type RecCategory = 'scale' | 'pause' | 'test' | 'replace' | 'expand' | 'repurpose' | 'other'

const ACTION_CATEGORY: Record<string, RecCategory> = {
  scale_channel: 'scale', amplify_variant: 'scale', clone_winner: 'scale',
  increase_production: 'scale', increase_upload_frequency: 'scale', push_variants: 'scale',
  activate_swarm_mode: 'scale', launch_swarm: 'scale', increase_budget: 'scale',
  pause_channel: 'pause', reduce_spend: 'pause', kill_niche: 'pause',
  create_variant_wave: 'test', optimize_pacing: 'test',
  generate_better_hook: 'replace',
  launch_expansion: 'expand', launch_new_channel: 'expand', shift_resources: 'expand',
  clone_retention_pattern: 'repurpose',
}

export function recCategory(actionKind: string): RecCategory {
  return ACTION_CATEGORY[actionKind] ?? 'other'
}

export const CATEGORY_LABEL: Record<RecCategory, string> = {
  scale: 'SCALE', pause: 'PAUSE', test: 'TEST', replace: 'REPLACE',
  expand: 'EXPAND', repurpose: 'REPURPOSE', other: 'OVERIG',
}

export const CATEGORY_COLOR: Record<RecCategory, string> = {
  scale: '#22c55e', pause: '#ef4444', test: '#f59e0b', replace: '#f97316',
  expand: '#a855f7', repurpose: '#38bdf8', other: '#64748b',
}

// leesbaar maken van een action_kind ("scale_channel" → "scale channel")
export function humanizeAction(actionKind: string): string {
  return actionKind.replace(/_/g, ' ')
}
