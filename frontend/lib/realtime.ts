'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeChangePayload = {
  schema: string
  table: string
  commit_timestamp: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, unknown>
  old: Record<string, unknown>
}

export type RealtimeSubscription = {
  table: string
  schema?: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
}

/**
 * Subscribe to Postgres changes for one or more Supabase tables.
 *
 * Falls back silently if NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are missing.
 * `onChange` fires for any matching row event; debounce in the caller if needed.
 */
export function useRealtimeChannel(
  channelName: string,
  subscriptions: RealtimeSubscription[],
  onChange: (payload: RealtimeChangePayload) => void,
) {
  const handlerRef = useRef(onChange)
  handlerRef.current = onChange

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return
    }
    if (subscriptions.length === 0) return

    const supabase = createClient()
    let channel: RealtimeChannel | null = supabase.channel(channelName)

    for (const sub of subscriptions) {
      const config: {
        event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
        schema: string
        table: string
        filter?: string
      } = {
        event: sub.event ?? '*',
        schema: sub.schema ?? 'public',
        table: sub.table,
      }
      if (sub.filter) config.filter = sub.filter

      channel = channel.on(
        'postgres_changes' as never,
        config as never,
        ((payload: RealtimeChangePayload) => handlerRef.current(payload)) as never,
      )
    }

    channel.subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subscriptions)])
}
