/**
 * Affiliate Intelligence Engine - Phase Tracker
 * Comprehensive tracking for all 9 phases of the project
 */

export type PhaseStatus = 'planned' | 'in-progress' | 'completed' | 'blocked'
export type ComponentStatus = 'pending' | 'in-progress' | 'completed' | 'on-hold'

export interface Component {
  id: string
  name: string
  description: string
  status: ComponentStatus
  assignee?: string
  progress_pct: number
  started_at?: Date
  completed_at?: Date
  dependencies: string[]
  notes?: string
}

export interface Phase {
  id: string
  number: number
  title: string
  description: string
  status: PhaseStatus
  progress_pct: number
  components: Component[]
  started_at?: Date
  target_completion?: Date
  completed_at?: Date
  dependencies: string[]
  owner?: string
  critical_path: boolean
}

export const AFFILIATE_INTELLIGENCE_PHASES: Phase[] = [
  {
    id: 'phase-1',
    number: 1,
    title: 'Affiliate Intelligence Engine Core',
    description: 'Build decision-making logic for affiliate selection',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'Platform Team',
    started_at: new Date('2025-01-01'),
    completed_at: new Date('2025-02-15'),
    dependencies: [],
    components: [
      {
        id: 'c1-1',
        name: 'Affiliate Intelligence Engine',
        description: 'Main decision engine with multi-factor recommendation logic',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-02-10'),
      },
      {
        id: 'c1-2',
        name: 'Channel Profile Matcher',
        description: 'Channel-to-affiliate mapping based on channel focus',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-02-12'),
      },
      {
        id: 'c1-3',
        name: 'Audience Matcher',
        description: 'Geography and demographic matching for audiences',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-02-15'),
      },
      {
        id: 'c1-4',
        name: 'Content Analyzer',
        description: 'Extract content signals (topic, keywords, niche)',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-02-12'),
      },
      {
        id: 'c1-5',
        name: 'Performance Scorer',
        description: 'Calculate recommendation scores based on historical data',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-02-15'),
      },
    ],
  },
  {
    id: 'phase-2',
    number: 2,
    title: 'Channel Strategy & Affiliate Mapping',
    description: 'Define optimal affiliate programs per channel',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'Strategy Team',
    started_at: new Date('2025-02-10'),
    completed_at: new Date('2025-03-01'),
    dependencies: ['phase-1'],
    components: [
      {
        id: 'c2-1',
        name: 'Channel Strategies Definition',
        description: 'Hardcoded channel profile mappings (VermogenTV, BeleggingsTv, etc)',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-02-20'),
      },
      {
        id: 'c2-2',
        name: 'Channel-Affiliate Mappings Database',
        description: 'Migration 103: affiliate_channel_mappings table with priorities',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-03-01'),
      },
      {
        id: 'c2-3',
        name: 'Country-Affiliate Mappings',
        description: 'Migration 103: affiliate_country_mappings table',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-03-01'),
      },
    ],
  },
  {
    id: 'phase-3',
    number: 3,
    title: 'Aquier as Central Hub',
    description: 'Create YouTube → Aquier → Funnel tracking flow',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'Aquier Integration Team',
    started_at: new Date('2025-03-01'),
    completed_at: new Date('2025-03-30'),
    dependencies: ['phase-2'],
    components: [
      {
        id: 'c3-1',
        name: 'Aquier Landing Events Table',
        description: 'Migration 104: aquier_landing_events for tracking visitor landings',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-03-15'),
      },
      {
        id: 'c3-2',
        name: 'Aquier Funnel Events Table',
        description: 'Migration 104: aquier_funnel_events for complete journey tracking',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-03-20'),
      },
      {
        id: 'c3-3',
        name: 'Dynamic Landing Page Component',
        description: 'React component that generates landing pages per channel/video',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-03-25'),
      },
    ],
  },
  {
    id: 'phase-4',
    number: 4,
    title: 'Revenue Intelligence Database',
    description: 'Comprehensive event tracking for attribution',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'Data Engineering',
    started_at: new Date('2025-03-30'),
    completed_at: new Date('2025-05-10'),
    dependencies: ['phase-3'],
    components: [
      {
        id: 'c4-1',
        name: 'Affiliate Conversion Events Table',
        description: 'Migration 104: aquier_conversion_events with full attribution',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-04-10'),
      },
      {
        id: 'c4-2',
        name: 'Membership Events Table',
        description: 'Migration 104: aquier_membership_events for member tracking',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-04-15'),
      },
      {
        id: 'c4-3',
        name: 'Checkout Events Table',
        description: 'Migration 104: aquier_checkout_events for purchase tracking',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-04-20'),
      },
      {
        id: 'c4-4',
        name: 'Revenue Metrics Views',
        description: 'SQL views for aggregated revenue metrics and dashboard data',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-10'),
      },
    ],
  },
  {
    id: 'phase-5',
    number: 5,
    title: 'AI Recommendations Engine',
    description: 'Build ML-powered affiliate suggestions',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'AI Team',
    started_at: new Date('2025-05-01'),
    completed_at: new Date('2025-05-20'),
    dependencies: ['phase-4'],
    components: [
      {
        id: 'c5-1',
        name: 'Affiliate Recommender Engine',
        description: 'Main recommendation logic using confidence scoring',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-15'),
      },
      {
        id: 'c5-2',
        name: 'Confidence Calculator',
        description: 'Score recommendations based on multiple factors',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-18'),
      },
      {
        id: 'c5-3',
        name: 'Model Versioning',
        description: 'Track and version recommendation models for A/B testing',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-20'),
      },
    ],
  },
  {
    id: 'phase-6',
    number: 6,
    title: 'Content Strategy - Auto-assign Affiliates',
    description: 'Per-video affiliate assignment logic',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'Frontend Team',
    started_at: new Date('2025-05-10'),
    completed_at: new Date('2025-05-25'),
    dependencies: ['phase-5'],
    components: [
      {
        id: 'c6-1',
        name: 'Content Affiliate Assigner',
        description: 'Auto-assign logic that selects best affiliate per video',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-20'),
      },
      {
        id: 'c6-2',
        name: 'UI Component for Recommendations',
        description: 'React component showing AI recommendations with override capability',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-23'),
      },
      {
        id: 'c6-3',
        name: 'Affiliate Assignment Tracking',
        description: 'content_affiliate_assignments table tracking AI vs manual',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-25'),
      },
    ],
  },
  {
    id: 'phase-7',
    number: 7,
    title: 'International Scaling Preparation',
    description: 'Support multiple countries with region-specific affiliates',
    status: 'completed',
    progress_pct: 100,
    critical_path: false,
    owner: 'Expansion Team',
    started_at: new Date('2025-05-15'),
    completed_at: new Date('2025-05-27'),
    dependencies: ['phase-4'],
    components: [
      {
        id: 'c7-1',
        name: 'Country Strategies Definition',
        description: 'Per-country affiliate preferences and compliance rules',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-22'),
      },
      {
        id: 'c7-2',
        name: 'Compliance Rules Engine',
        description: 'Handle regulatory rules per country',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-25'),
      },
      {
        id: 'c7-3',
        name: 'Multi-currency Support',
        description: 'Currency conversion and localized pricing',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-27'),
      },
    ],
  },
  {
    id: 'phase-8',
    number: 8,
    title: 'Revenue Goals & Optimization Dashboard',
    description: 'Track targets and automatically optimize',
    status: 'completed',
    progress_pct: 100,
    critical_path: true,
    owner: 'Analytics Team',
    started_at: new Date('2025-05-20'),
    completed_at: new Date('2025-05-27'),
    dependencies: ['phase-6', 'phase-7'],
    components: [
      {
        id: 'c8-1',
        name: 'Revenue Goal Tracker',
        description: 'Goal management with monthly/quarterly/yearly targets',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-23'),
      },
      {
        id: 'c8-2',
        name: 'Affiliate Optimizer Engine',
        description: 'Auto-optimization recommendations for scaling/removing affiliates',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-24'),
      },
      {
        id: 'c8-3',
        name: 'Revenue Intelligence API Endpoint',
        description: '/api/media-holding/revenue-intelligence/metrics endpoint',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-27'),
      },
      {
        id: 'c8-4',
        name: 'Revenue Intelligence Dashboard',
        description: 'Comprehensive dashboard showing metrics, performance, recommendations',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-27'),
      },
    ],
  },
  {
    id: 'phase-9',
    number: 9,
    title: 'Build Tracker & Milestones',
    description: 'Organizational structure for tracking all 9 phases',
    status: 'completed',
    progress_pct: 100,
    critical_path: false,
    owner: 'Project Manager',
    started_at: new Date('2025-05-27'),
    completed_at: new Date('2025-05-27'),
    dependencies: ['phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7', 'phase-8'],
    components: [
      {
        id: 'c9-1',
        name: 'Phase Tracker Types & Data Model',
        description: 'TypeScript types and phase definitions for tracking',
        status: 'completed',
        progress_pct: 100,
        dependencies: [],
        completed_at: new Date('2025-05-27'),
      },
      {
        id: 'c9-2',
        name: 'Phase Tracker API Endpoint',
        description: '/api/affiliate-intelligence/phases endpoint for real-time data',
        status: 'completed',
        progress_pct: 100,
        dependencies: ['c9-1'],
        completed_at: new Date('2025-05-27'),
      },
      {
        id: 'c9-3',
        name: 'Phase Tracker Dashboard UI',
        description: 'Comprehensive dashboard showing all 9 phases, progress, dependencies',
        status: 'completed',
        progress_pct: 100,
        dependencies: ['c9-2'],
        completed_at: new Date('2025-05-27'),
      },
      {
        id: 'c9-4',
        name: 'Milestones & Timeline Visualization',
        description: 'Gantt chart or timeline view of all phases with critical path analysis',
        status: 'completed',
        progress_pct: 100,
        dependencies: ['c9-3'],
        completed_at: new Date('2025-05-27'),
      },
    ],
  },
]

export function getPhaseById(phaseId: string): Phase | undefined {
  return AFFILIATE_INTELLIGENCE_PHASES.find(p => p.id === phaseId)
}

export function getPhaseByNumber(number: number): Phase | undefined {
  return AFFILIATE_INTELLIGENCE_PHASES.find(p => p.number === number)
}

export function getProjectProgress(): { total_progress: number; completed_phases: number; active_phases: number } {
  const completed = AFFILIATE_INTELLIGENCE_PHASES.filter(p => p.status === 'completed').length
  const active = AFFILIATE_INTELLIGENCE_PHASES.filter(p => p.status === 'in-progress').length
  const avgProgress = Math.round(AFFILIATE_INTELLIGENCE_PHASES.reduce((sum, p) => sum + p.progress_pct, 0) / AFFILIATE_INTELLIGENCE_PHASES.length)

  return {
    total_progress: avgProgress,
    completed_phases: completed,
    active_phases: active,
  }
}

export function calculatePhaseDependencies(phaseId: string): { blockedBy: Phase[]; blocks: Phase[] } {
  const phase = getPhaseById(phaseId)
  if (!phase) return { blockedBy: [], blocks: [] }

  const blockedBy = AFFILIATE_INTELLIGENCE_PHASES.filter(p => phase.dependencies.includes(p.id))
  const blocks = AFFILIATE_INTELLIGENCE_PHASES.filter(p => p.dependencies.includes(phaseId))

  return { blockedBy, blocks }
}
