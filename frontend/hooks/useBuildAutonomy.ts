'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface BuildAutonomy {
  id: string
  build_id: string
  autonomy_level: 'full' | 'partial' | 'manual'
  autonomy_pct: number
  hermes_workflow_exists: boolean
  required_approvals: string[] | null
  required_skills: string[] | null
  external_integrations: string[] | null
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  blocking_factors: Record<string, unknown> | null
  can_execute_today: boolean
  estimated_completion_time_hours: number | null
  last_evaluated_at: string | null
  confidence_score: number | null
}

export function useBuildAutonomy(buildId: string) {
  const [autonomy, setAutonomy] = useState<BuildAutonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const fetchAutonomy = async () => {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from('build_autonomy_score')
          .select('*')
          .eq('build_id', buildId)
          .single()

        if (err) throw err
        setAutonomy(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch autonomy')
      } finally {
        setLoading(false)
      }
    }

    fetchAutonomy()

    channel = supabase
      .channel(`build_autonomy:${buildId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'build_autonomy_score',
          filter: `build_id=eq.${buildId}`,
        },
        () => {
          fetchAutonomy()
        }
      )
      .subscribe()

    return () => {
      channel?.unsubscribe()
    }
  }, [buildId])

  return { autonomy, loading, error }
}
