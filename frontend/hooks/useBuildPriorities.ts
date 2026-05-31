'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface BuildPriority {
  build_id: string
  company_id: string
  name: string
  status: string
  progress_pct: number
  current_priority: number
  calculated_priority: number
  manual_priority_override: number | null
  depends_on_count: number
  blocked_by_count: number
  autonomy_boost_applied: number
  autonomy_level: string | null
  autonomy_pct: number | null
  can_execute_today: boolean | null
  last_recalc_at: string | null
  recalc_reason: string | null
}

export function useBuildPriorities(companyId: string) {
  const [priorities, setPriorities] = useState<BuildPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const fetchPriorities = async () => {
      try {
        setLoading(true)
        const { data, error: err } = await supabase
          .from('v_build_priority_queue')
          .select('*')
          .eq('company_id', companyId)
          .order('current_priority', { ascending: true })

        if (err) throw err
        setPriorities(data || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch priorities')
      } finally {
        setLoading(false)
      }
    }

    fetchPriorities()

    channel = supabase
      .channel(`build_priorities:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'build_priority_queue',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchPriorities()
        }
      )
      .subscribe()

    return () => {
      channel?.unsubscribe()
    }
  }, [companyId])

  return { priorities, loading, error }
}
