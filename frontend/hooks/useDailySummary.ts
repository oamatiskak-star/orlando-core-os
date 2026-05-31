'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface DailySummary {
  id: string
  company_id: string
  company_name?: string
  summary_date: string
  queued_count: number
  in_progress_count: number
  completed_count: number
  blocked_count: number
  fully_autonomous_count: number
  partially_autonomous_count: number
  manual_count: number
  agent_deliveries_count: number
  snapshot_data: {
    queued?: Array<{ id: string; name: string; status: string; progress: number; priority: number; autonomy: string }>
    in_progress?: Array<{ id: string; name: string; status: string; progress: number; priority: number; autonomy: string }>
    completed?: Array<{ id: string; name: string; completed_at: string }>
    agent_deliveries?: Array<{ agent: string; action: string; status: string; build: string; at: string }>
    generated_at: string
  } | null
  generated_at: string
}

export function useDailySummary(companyId: string) {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    const fetchSummary = async () => {
      try {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]
        const { data, error: err } = await supabase
          .from('v_daily_build_overview')
          .select('*')
          .eq('company_id', companyId)
          .eq('summary_date', today)
          .single()

        if (err && err.code !== 'PGRST116') throw err
        setSummary(data || null)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch summary')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()

    channel = supabase
      .channel(`daily_summary:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'build_daily_summary',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchSummary()
        }
      )
      .subscribe()

    return () => {
      channel?.unsubscribe()
    }
  }, [companyId])

  return { summary, loading, error }
}
