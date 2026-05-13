import { createClient } from './server'

export type VastgoedDeal = {
  id: string
  title: string | null
  address: string | null
  city: string | null
  asking_price: number | null
  sqm: number | null
  price_per_sqm: number | null
  potential_profit: number | null
  verbouw_kosten: number | null
  roi_percentage: number | null
  deal_score: number | null
  class: string | null
  source: string | null
  status: string | null
  pipeline_fase: string | null
  energy_label: string | null
  funda_url: string | null
  notes: string | null
  labels: string[]
  priority: string | null
  created_at: string
  updated_at: string
}

export type DashboardStats = {
  actieve_agents: number
  open_taken: number
  lopende_projecten: number
  vastgoed_deals: number
  maandomzet: number
  system_health: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()

  const [agentsRes, takenRes, projectenRes, dealsRes] = await Promise.all([
    supabase.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['pending', 'queued', 'processing']),
    supabase.from('projecten').select('id', { count: 'exact', head: true }).eq('status', 'actief'),
    supabase.from('deals').select('id', { count: 'exact', head: true }).not('pipeline_fase', 'in', '("gewonnen","verloren")').not('pipeline_fase', 'is', null),
  ])

  return {
    actieve_agents: agentsRes.count ?? 0,
    open_taken: takenRes.count ?? 0,
    lopende_projecten: projectenRes.count ?? 0,
    vastgoed_deals: dealsRes.count ?? 0,
    maandomzet: 0,
    system_health: 98,
  }
}

export async function getVastgoedDeals(): Promise<VastgoedDeal[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select('*')
    .not('pipeline_fase', 'is', null)
    .order('created_at', { ascending: false })
  return (data as VastgoedDeal[]) ?? []
}

export async function getVastgoedDealById(id: string): Promise<VastgoedDeal | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()
  return data as VastgoedDeal | null
}
