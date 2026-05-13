'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TokenAutoRefresh() {
  useEffect(() => {
    const supabase = createClient()

    async function refreshExpiringTokens() {
      const { data: channels } = await supabase
        .from('youtube_channels')
        .select('id, naam, token_expires, oauth_status')
        .in('oauth_status', ['connected', 'expired'])
        .not('token_expires', 'is', null)

      if (!channels?.length) return

      const expiringSoon = channels.filter(ch => {
        const exp = new Date(ch.token_expires!)
        return exp < new Date(Date.now() + 10 * 60 * 1000)
      })

      if (!expiringSoon.length) return

      await Promise.allSettled(
        expiringSoon.map(ch =>
          fetch('/api/youtube/token-refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: ch.id }),
          })
        )
      )
    }

    refreshExpiringTokens()

    // Re-check every 5 minutes while dashboard is open
    const interval = setInterval(refreshExpiringTokens, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return null
}
