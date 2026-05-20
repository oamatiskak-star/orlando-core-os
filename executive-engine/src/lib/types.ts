export type AgentKey =
  | 'atlas'
  | 'viral_analyst'
  | 'channel_manager'
  | 'algorithm_strategist'
  | 'retention_scientist'
  | 'content_fund_manager'

export type RunStatus = 'running' | 'completed' | 'failed' | 'skipped'

export type DecisionStatus =
  | 'promising'
  | 'breakout'
  | 'scale_ready'
  | 'saturated'
  | 'underperforming'
  | 'terminated'

export type ReportKind =
  | 'daily_briefing'
  | 'weekly_boardroom'
  | 'channel_deep_dive'
  | 'viral_post_mortem'
  | 'retention_intelligence'
  | 'algorithm_strategy'
  | 'fund_allocation'

export type ActionKind =
  | 'scale_channel'
  | 'kill_niche'
  | 'clone_winner'
  | 'amplify_variant'
  | 'launch_swarm'
  | 'pause_channel'
  | 'approve_strategy'
  | 'launch_expansion'
  | 'increase_production'
  | 'generate_better_hook'
  | 'clone_retention_pattern'
  | 'optimize_pacing'
  | 'activate_swarm_mode'
  | 'push_variants'
  | 'increase_upload_frequency'
  | 'analyze_competitor'
  | 'clone_format'
  | 'build_counter_strategy'
  | 'increase_budget'
  | 'reduce_spend'
  | 'shift_resources'
  | 'create_variant_wave'
  | 'launch_new_channel'

export type TargetKind = 'channel' | 'content' | 'niche' | 'competitor' | 'allocation' | 'ecosystem'

export type RecommendationDraft = {
  action_kind: ActionKind
  target_kind: TargetKind
  target_id?: string | null
  priority: number
  rationale: string
  payload?: Record<string, unknown>
}

export type AgentDefinition = {
  agent_key: AgentKey
  name: string
  role_persona: string
  system_prompt: string
  model: string
  max_tokens: number
  enabled: boolean
}
