import { createClient } from '@/lib/supabase/server'

export interface StorageStats {
  companyId: string
  companyName: string
  totalStorage: number
  usedStorage: number
  percentage: number
  fileCount: number
}

export interface MailStats {
  companyId: string
  companyName: string
  todayCount: number
  totalUnread: number
  averageResponseTime: string
}

export interface UploadStats {
  date: string
  count: number
  totalSize: number
  companyId: string
}

export interface ViewStats {
  companyId: string
  companyName: string
  pageViews: number
  uniqueVisitors: number
  bounceRate: number
  avgSessionDuration: string
}

export async function getStorageStats(): Promise<StorageStats[]> {
  const supabase = await createClient()

  const { data: uploads } = await supabase
    .from('uploads')
    .select('company_id, file_size, created_at')
    .gte('created_at', new Date(new Date().setDate(new Date().getDate() - 30)).toISOString())

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')

  const storageMap: Record<string, { totalSize: number; fileCount: number }> = {}

  if (uploads) {
    for (const upload of uploads) {
      if (!storageMap[upload.company_id]) {
        storageMap[upload.company_id] = { totalSize: 0, fileCount: 0 }
      }
      storageMap[upload.company_id].totalSize += upload.file_size || 0
      storageMap[upload.company_id].fileCount += 1
    }
  }

  const totalStorageQuota = 100 * 1024 * 1024 * 1024 // 100GB per company

  return (companies || []).map((company) => {
    const stats = storageMap[company.id] || { totalSize: 0, fileCount: 0 }
    const usedStorage = stats.totalSize
    const percentage = Math.round((usedStorage / totalStorageQuota) * 100)

    return {
      companyId: company.id,
      companyName: company.name,
      totalStorage: totalStorageQuota,
      usedStorage,
      percentage: Math.min(percentage, 100),
      fileCount: stats.fileCount,
    }
  })
}

export async function getMailStats(): Promise<MailStats[]> {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: messages } = await supabase
    .from('mail_messages')
    .select('company_id, read_at, response_time, created_at')
    .gte('created_at', `${today}T00:00:00`)

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')

  const mailMap: Record<string, { todayCount: number; unread: number; responseTimes: number[] }> = {}

  if (messages) {
    for (const msg of messages) {
      if (!mailMap[msg.company_id]) {
        mailMap[msg.company_id] = { todayCount: 0, unread: 0, responseTimes: [] }
      }
      mailMap[msg.company_id].todayCount += 1
      if (!msg.read_at) mailMap[msg.company_id].unread += 1
      if (msg.response_time) mailMap[msg.company_id].responseTimes.push(msg.response_time)
    }
  }

  return (companies || []).map((company) => {
    const stats = mailMap[company.id] || { todayCount: 0, unread: 0, responseTimes: [] }
    const avgTime =
      stats.responseTimes.length > 0
        ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
        : 0

    const hours = Math.floor(avgTime / 60)
    const minutes = avgTime % 60

    return {
      companyId: company.id,
      companyName: company.name,
      todayCount: stats.todayCount,
      totalUnread: stats.unread,
      averageResponseTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    }
  })
}

export async function getUploadStats(days: number = 7): Promise<UploadStats[]> {
  const supabase = await createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: uploads } = await supabase
    .from('uploads')
    .select('company_id, file_size, created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })

  const statsMap: Record<string, { date: string; count: number; totalSize: number }> = {}

  if (uploads) {
    for (const upload of uploads) {
      const date = new Date(upload.created_at).toISOString().split('T')[0]
      const key = `${upload.company_id}-${date}`

      if (!statsMap[key]) {
        statsMap[key] = { date, count: 0, totalSize: 0 }
      }
      statsMap[key].count += 1
      statsMap[key].totalSize += upload.file_size || 0
    }
  }

  return Object.values(statsMap)
}

export async function getViewStats(): Promise<ViewStats[]> {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: events } = await supabase
    .from('page_views')
    .select('company_id, session_id, duration, bounce')
    .gte('created_at', `${today}T00:00:00`)

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')

  const viewMap: Record<string, { views: number; sessions: Set<string>; bounces: number; durations: number[] }> = {}

  if (events) {
    for (const event of events) {
      if (!viewMap[event.company_id]) {
        viewMap[event.company_id] = { views: 0, sessions: new Set(), bounces: 0, durations: [] }
      }
      viewMap[event.company_id].views += 1
      viewMap[event.company_id].sessions.add(event.session_id)
      if (event.bounce) viewMap[event.company_id].bounces += 1
      if (event.duration) viewMap[event.company_id].durations.push(event.duration)
    }
  }

  return (companies || []).map((company) => {
    const stats = viewMap[company.id] || { views: 0, sessions: new Set(), bounces: 0, durations: [] }
    const avgDuration =
      stats.durations.length > 0
        ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
        : 0
    const bounceRate =
      stats.views > 0 ? Math.round((stats.bounces / stats.views) * 100) : 0

    return {
      companyId: company.id,
      companyName: company.name,
      pageViews: stats.views,
      uniqueVisitors: stats.sessions.size,
      bounceRate,
      avgSessionDuration: `${avgDuration}s`,
    }
  })
}
