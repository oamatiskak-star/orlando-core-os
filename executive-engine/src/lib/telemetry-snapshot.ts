import { supabase } from './supabase'

export type EcosystemSnapshot = {
  generated_at: string
  ecosystem: {
    channels_active: number
    views_24h: number
    views_7d: number
    retention_avg_7d: number
    critical_alerts_open: number
    alerts_open_total: number
    recs_pending: number
    revenue_30d: number
    spend_30d: number
  }
  per_channel: ChannelSnapshot[]
  top_videos_7d: VideoSnapshot[]
  trends: { rising_keywords: TrendSignal[]; audio_velocity: AudioSignal[] }
  risks: { saturation_warnings: number; failed_uploads_24h: number; low_retention_videos: number }
}

export type ChannelSnapshot = {
  id: string
  name: string
  niche: string | null
  status: string
  current_status: string | null
  target_views_10d: number
  views_7d: number
  views_24h: number
  retention_avg: number
  uploads_14d: number
  current_views_10d: number
}

export type VideoSnapshot = {
  content_item_id: string | null
  channel_id: string | null
  channel_name: string | null
  title: string | null
  views: number
  retention_pct: number
  ctr_pct: number
  snapshot_at: string
}

export type TrendSignal = {
  keyword: string
  momentum: number
  source: string
  region: string | null
}

export type AudioSignal = {
  name: string
  artist: string | null
  trend_velocity: number
  platform: string
}

export async function buildEcosystemSnapshot(): Promise<EcosystemSnapshot> {
  const [kpis, channels, topVideos, trends, audio, risks] = await Promise.all([
    fetchKpis(),
    fetchChannelSnapshots(),
    fetchTopVideos(7),
    fetchTrendSignals(10),
    fetchAudioSignals(10),
    fetchRiskCounts(),
  ])

  return {
    generated_at: new Date().toISOString(),
    ecosystem: kpis,
    per_channel: channels,
    top_videos_7d: topVideos,
    trends: { rising_keywords: trends, audio_velocity: audio },
    risks,
  }
}

async function fetchKpis(): Promise<EcosystemSnapshot['ecosystem']> {
  const { data, error } = await supabase.from('v_executive_kpis').select('*').single()
  if (error || !data) {
    return {
      channels_active: 0,
      views_24h: 0,
      views_7d: 0,
      retention_avg_7d: 0,
      critical_alerts_open: 0,
      alerts_open_total: 0,
      recs_pending: 0,
      revenue_30d: 0,
      spend_30d: 0,
    }
  }
  return {
    channels_active: Number(data.channels_active ?? 0),
    views_24h: Number(data.views_24h ?? 0),
    views_7d: Number(data.views_7d ?? 0),
    retention_avg_7d: Number(data.retention_avg_7d ?? 0),
    critical_alerts_open: Number(data.critical_alerts_open ?? 0),
    alerts_open_total: Number(data.alerts_open_total ?? 0),
    recs_pending: Number(data.recs_pending ?? 0),
    revenue_30d: Number(data.revenue_30d ?? 0),
    spend_30d: Number(data.spend_30d ?? 0),
  }
}

export async function fetchChannelSnapshots(): Promise<ChannelSnapshot[]> {
  const { data: channels, error } = await supabase
    .from('media_holding_channels')
    .select('id,name,niche,status,current_status,target_views_10d,current_views_10d')
    .in('status', ['live', 'scaling', 'incubating'])

  if (error || !channels) return []

  const channelIds = channels.map(c => c.id as string)
  if (channelIds.length === 0) return []

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: contentItems } = await supabase
    .from('media_holding_content_items')
    .select('channel_id,created_at')
    .gte('created_at', fourteenDaysAgo)
    .in('channel_id', channelIds)

  const { data: metricsRows } = await supabase
    .from('media_holding_metrics')
    .select('views,retention_pct,snapshot_at,content_item_id,upload_id')
    .gte('snapshot_at', sevenDaysAgo)

  const channelByContent = new Map<string, string>()
  const { data: contentChannelLink } = await supabase
    .from('media_holding_content_items')
    .select('id,channel_id')
    .in('channel_id', channelIds)
  for (const row of contentChannelLink ?? []) {
    if (row.id && row.channel_id) channelByContent.set(row.id as string, row.channel_id as string)
  }

  const views7d = new Map<string, number>()
  const views24h = new Map<string, number>()
  const retentionSum = new Map<string, { sum: number; n: number }>()

  for (const m of metricsRows ?? []) {
    const channelId = channelByContent.get(m.content_item_id as string)
    if (!channelId) continue
    const v = Number(m.views ?? 0)
    views7d.set(channelId, (views7d.get(channelId) ?? 0) + v)
    if (new Date(m.snapshot_at as string) >= new Date(twentyFourHoursAgo)) {
      views24h.set(channelId, (views24h.get(channelId) ?? 0) + v)
    }
    const r = Number(m.retention_pct ?? 0)
    if (r > 0) {
      const prev = retentionSum.get(channelId) ?? { sum: 0, n: 0 }
      retentionSum.set(channelId, { sum: prev.sum + r, n: prev.n + 1 })
    }
  }

  const uploads14d = new Map<string, number>()
  for (const row of contentItems ?? []) {
    const cid = row.channel_id as string
    uploads14d.set(cid, (uploads14d.get(cid) ?? 0) + 1)
  }

  return channels.map(c => {
    const cid = c.id as string
    const rs = retentionSum.get(cid)
    return {
      id: cid,
      name: c.name as string,
      niche: c.niche as string | null,
      status: c.status as string,
      current_status: c.current_status as string | null,
      target_views_10d: Number(c.target_views_10d ?? 0),
      views_7d: views7d.get(cid) ?? 0,
      views_24h: views24h.get(cid) ?? 0,
      retention_avg: rs ? rs.sum / rs.n : 0,
      uploads_14d: uploads14d.get(cid) ?? 0,
      current_views_10d: Number(c.current_views_10d ?? 0),
    }
  })
}

export async function fetchTopVideos(days: number): Promise<VideoSnapshot[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('media_holding_metrics')
    .select('views,retention_pct,ctr_pct,snapshot_at,content_item_id')
    .gte('snapshot_at', since)
    .order('views', { ascending: false })
    .limit(20)
  if (error || !data) return []

  const contentIds = Array.from(new Set(data.map(d => d.content_item_id as string).filter(Boolean)))
  if (contentIds.length === 0) return []

  const { data: items } = await supabase
    .from('media_holding_content_items')
    .select('id,title,channel_id')
    .in('id', contentIds)

  const { data: channels } = await supabase
    .from('media_holding_channels')
    .select('id,name')

  const channelNameById = new Map<string, string>()
  for (const c of channels ?? []) channelNameById.set(c.id as string, c.name as string)
  const itemById = new Map<string, { title: string | null; channel_id: string | null }>()
  for (const i of items ?? []) itemById.set(i.id as string, { title: i.title as string | null, channel_id: i.channel_id as string | null })

  return data.slice(0, 5).map(m => {
    const item = itemById.get(m.content_item_id as string)
    const channelId = item?.channel_id ?? null
    return {
      content_item_id: (m.content_item_id as string) ?? null,
      channel_id: channelId,
      channel_name: channelId ? channelNameById.get(channelId) ?? null : null,
      title: item?.title ?? null,
      views: Number(m.views ?? 0),
      retention_pct: Number(m.retention_pct ?? 0),
      ctr_pct: Number(m.ctr_pct ?? 0),
      snapshot_at: m.snapshot_at as string,
    }
  })
}

export async function fetchTrendSignals(limit: number): Promise<TrendSignal[]> {
  const { data, error } = await supabase
    .from('trend_scanner_signals')
    .select('keyword,momentum,source,region')
    .order('momentum', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(d => ({
    keyword: d.keyword as string,
    momentum: Number(d.momentum ?? 0),
    source: d.source as string,
    region: (d.region as string | null) ?? null,
  }))
}

export async function fetchAudioSignals(limit: number): Promise<AudioSignal[]> {
  const { data, error } = await supabase
    .from('audio_library')
    .select('name,artist,trend_velocity,platform')
    .order('trend_velocity', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(d => ({
    name: d.name as string,
    artist: (d.artist as string | null) ?? null,
    trend_velocity: Number(d.trend_velocity ?? 0),
    platform: d.platform as string,
  }))
}

async function fetchRiskCounts(): Promise<EcosystemSnapshot['risks']> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ count: saturationCount }, { count: failedUploads }, { count: lowRetentionCount }] = await Promise.all([
    supabase.from('executive_alerts').select('id', { count: 'exact', head: true })
      .eq('alert_kind', 'saturation_warning').is('acknowledged_at', null),
    supabase.from('media_holding_uploads').select('id', { count: 'exact', head: true })
      .eq('status', 'failed').gte('updated_at', since24h),
    supabase.from('media_holding_metrics').select('id', { count: 'exact', head: true })
      .lt('retention_pct', 0.4).gte('snapshot_at', since24h),
  ])
  return {
    saturation_warnings: saturationCount ?? 0,
    failed_uploads_24h: failedUploads ?? 0,
    low_retention_videos: lowRetentionCount ?? 0,
  }
}
