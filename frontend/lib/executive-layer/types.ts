export type DecisionStatus =
  | 'promising'
  | 'breakout'
  | 'scale_ready'
  | 'saturated'
  | 'underperforming'
  | 'terminated'

export type AlertKind =
  | 'breakout'
  | 'upload_failure'
  | 'trend_explosion'
  | 'saturation_warning'
  | 'velocity_spike'
  | 'high_retention'
  | 'subscriber_acceleration'

export type AlertSeverity = 'info' | 'warn' | 'critical'

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

export type RecommendationStatus = 'pending' | 'approved' | 'dismissed' | 'executed' | 'expired'

export type ChannelMetricsForDecision = {
  channel_id: string
  views_7d: number
  views_14d: number
  retention_avg_7d: number
  retention_avg_14d: number
  viral_uploads_14d: number
  upload_count_7d: number
  view_velocity_variance: number
  saturation_index: number
  roi_30d: number
  underperforming_weeks: number
  manual_terminated: boolean
}

export type DecisionResult = {
  status: DecisionStatus
  confidence: number
  rationale: Record<string, unknown>
}

export const DECISION_THRESHOLDS = {
  BREAKOUT_VIEWS_14D: 500_000,
  BREAKOUT_VIRAL_UPLOADS: 2,
  PROMISING_VIEWS_7D: 150_000,
  PROMISING_RETENTION_MIN: 0.75,
  SCALE_READY_VARIANCE_MAX: 0.3,
  SCALE_READY_ROI_MIN: 0.5,
  SCALE_READY_SATURATION_MAX: 0.6,
  SATURATED_INDEX_MIN: 0.8,
  UNDERPERFORMING_VIEWS_7D_MAX: 10_000,
  UNDERPERFORMING_RETENTION_MAX: 0.5,
  TERMINATED_UNDERPERF_WEEKS: 4,
  TERMINATED_NEGATIVE_ROI_DAYS: 30,
} as const
