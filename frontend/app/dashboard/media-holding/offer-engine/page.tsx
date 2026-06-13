import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import OfferEngineClient from './OfferEngineClient'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function OfferEnginePage() {
  const supabase = await createClient()
  const [{ data: rows }, { data: runs }] = await Promise.all([
    supabase.from('v_offer_candidate_scores').select('*').order('score', { ascending: false }),
    supabase.from('offer_engine_runs').select('*').order('created_at', { ascending: false }).limit(1),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Package size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Offer Engine</h1>
          <p className="text-xs text-white/45">
            Eigen aanbod-voorstellen (rapport/cursus/membership/…) per niche — propose-only, mens beslist
          </p>
        </div>
      </div>
      <OfferEngineClient initial={(rows ?? []) as never} lastRun={(runs?.[0] ?? null) as never} />
    </div>
  )
}
