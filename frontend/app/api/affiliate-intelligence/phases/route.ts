import { NextRequest, NextResponse } from 'next/server'
import { AFFILIATE_INTELLIGENCE_PHASES, getProjectProgress } from '@/ai-os/affiliate-intelligence/phase-tracker'

export const revalidate = 0

export async function GET(_req: NextRequest) {
  try {
    const projectProgress = getProjectProgress()

    return NextResponse.json({
      project: {
        name: 'Affiliate Intelligence Engine',
        description: 'Comprehensive 9-phase system for intelligent affiliate program selection and revenue optimization',
        status: 'in-progress',
        ...projectProgress,
        start_date: '2025-01-01',
        current_date: new Date().toISOString(),
      },
      phases: AFFILIATE_INTELLIGENCE_PHASES,
      timeline: {
        phase_1: { title: 'Core Engine', dates: '2025-01-01 to 2025-02-15' },
        phase_2: { title: 'Channel Strategy', dates: '2025-02-10 to 2025-03-01' },
        phase_3: { title: 'Aquier Integration', dates: '2025-03-01 to 2025-03-30' },
        phase_4: { title: 'Revenue DB', dates: '2025-03-30 to 2025-05-10' },
        phase_5: { title: 'AI Engine', dates: '2025-05-01 to 2025-05-20' },
        phase_6: { title: 'Auto-assign', dates: '2025-05-10 to 2025-05-25' },
        phase_7: { title: 'International', dates: '2025-05-15 to 2025-05-27' },
        phase_8: { title: 'Dashboard', dates: '2025-05-20 to 2025-05-27' },
        phase_9: { title: 'Build Tracker', dates: '2025-05-27 to 2025-05-28' },
      },
      summary: {
        total_phases: AFFILIATE_INTELLIGENCE_PHASES.length,
        critical_path_phases: AFFILIATE_INTELLIGENCE_PHASES.filter(p => p.critical_path).length,
        estimated_total_effort_days: 147,
        documentation_url: 'https://github.com/oamatiskak-star/orlando-core-os/blob/claude/stack-selection-question-qKSjm/CLAUDE.md',
      },
    })
  } catch (error) {
    console.error('Phase tracker error:', error)
    return NextResponse.json({ error: 'Failed to fetch phase data' }, { status: 500 })
  }
}
