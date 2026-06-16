import type { SupabaseClient } from '@supabase/supabase-js'

// Monetisatie-executielaag: injecteert de affiliate-links van een kanaal in de
// video-beschrijving bij publicatie. Dit was de ontbrekende schakel — affiliate_links
// bestonden in de DB maar kwamen nooit vóór de kijker (0 clicks/conversies). Voor
// US-finance zijn dit broker-links (Robinhood/Webull/Moomoo) met hoog payout-plafond.
//
// Fail-open: bij DB-fout of geen links → lege footer, de upload gaat gewoon door.

interface AffLink { product: string | null; url: string | null; short_link: string | null }

export async function buildAffiliateFooter(db: SupabaseClient, channelId: string): Promise<string> {
  if (!channelId) return ''
  try {
    const { data, error } = await db
      .from('affiliate_links')
      .select('product, url, short_link')
      .eq('channel_id', channelId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(6)
    if (error || !data || data.length === 0) return ''

    const lines = (data as AffLink[])
      .map((l) => {
        const link = l.short_link || l.url
        if (!link) return null
        return `• ${l.product ?? 'Resource'}: ${link}`
      })
      .filter(Boolean)
    if (lines.length === 0) return ''

    return [
      '',
      '— — —',
      '📊 Tools & resources:',
      ...lines,
      '',
      'This is not financial advice. Some links above are affiliate links; I may earn a commission at no extra cost to you.',
    ].join('\n')
  } catch {
    return ''
  }
}
