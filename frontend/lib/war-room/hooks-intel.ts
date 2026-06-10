// Hook Intelligence — gedeelde categorie-meta (14 psychologische categorieën).
export const HOOK_CATEGORIES = [
  'money', 'proof', 'authority', 'transformation', 'speed', 'urgency', 'fear',
  'contrarian', 'status', 'mystery', 'story', 'shock', 'curiosity', 'education',
] as const
export type HookCategory = (typeof HOOK_CATEGORIES)[number]

export const CAT_LABEL: Record<string, string> = {
  money: 'Money', proof: 'Proof', authority: 'Authority', transformation: 'Transformation',
  speed: 'Speed', urgency: 'Urgency', fear: 'Fear', contrarian: 'Contrarian', status: 'Status',
  mystery: 'Mystery', story: 'Story', shock: 'Shock', curiosity: 'Curiosity', education: 'Education',
}
export const CAT_COLOR: Record<string, string> = {
  money: '#22c55e', proof: '#10b981', authority: '#6366f1', transformation: '#a855f7',
  speed: '#06b6d4', urgency: '#f59e0b', fear: '#ef4444', contrarian: '#f97316', status: '#eab308',
  mystery: '#8b5cf6', story: '#38bdf8', shock: '#ec4899', curiosity: '#14b8a6', education: '#64748b',
}

export const NICHE_LABEL: Record<string, string> = {
  finance_education_nl: 'Vermogen / Beleggen (NL)',
  finance_education_es: 'Finance (ES)',
  vastgoed_education_nl: 'Vastgoed (NL)',
  satisfying_cutting: 'Satisfying · cutting',
  satisfying_brick_world: 'Satisfying · brick',
  'seamless loops / satisfying / mini-world': 'Satisfying · loops',
  overig: 'Overig',
}
export const nicheLabel = (n: string | null) => (n ? NICHE_LABEL[n] ?? n : 'Overig')
