import { createClient } from '@/lib/supabase/server'
import { TrendingUp, TrendingDown, Minus, CalendarClock, Flame, Clock } from 'lucide-react'
import CreativePreview from '@/components/war-room/CreativePreview'
import { resolvePreview } from '@/lib/war-room/preview'

export const dynamic = 'force-dynamic'

// YouTube category-codes → leesbaar
const CAT: Record<string, string> = {
  youtube_cat_1: 'Film & Animatie', youtube_cat_2: "Auto's", youtube_cat_10: 'Muziek',
  youtube_cat_17: 'Sport', youtube_cat_20: 'Gaming', youtube_cat_22: 'People & Blogs',
  youtube_cat_23: 'Comedy', youtube_cat_24: 'Entertainment', youtube_cat_25: 'Nieuws & Politiek',
  youtube_cat_27: 'Educatie', youtube_cat_28: 'Wetenschap & Tech', youtube_cat_29: 'Non-profit',
}
const catLabel = (n: string | null) => (n ? CAT[n] ?? n : '—')
const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

type Momentum = { niche: string; n_recent: number; vir_recent: number; vel_recent: number; vir_prior: number | null; momentum: string }
type Candidate = { id: string; title: string; channel_name: string | null; niche: string | null; views: number; view_velocity: number; virality_score: number; thumbnail_url: string | null; url: string | null }
type Planned = { id: string; title_draft: string; niche: string | null; confidence: number | null; expected_views: number | null; planned_publish_at: string | null; reason: string | null }

export default async function ContentHorizonPage() {
  const supabase = await createClient()
  const [momRes, candRes, planRes] = await Promise.all([
    supabase.from('v_niche_momentum').select('*'),
    supabase.from('v_viral_candidates').select('id, title, channel_name, niche, views, view_velocity, virality_score, thumbnail_url, url').limit(24),
    supabase.from('content_horizon').select('id, title_draft, niche, confidence, expected_views, planned_publish_at, reason').eq('status', 'planned').order('planned_publish_at').limit(50),
  ])

  const gated = momRes.error || candRes.error
  const moms = (momRes.data ?? []) as Momentum[]
  const cands = (candRes.data ?? []) as Candidate[]
  const plans = (planRes.data ?? []) as Planned[]

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">Content voor overmorgen — plant op LIVE performance (viral-radar + analytics), niet op een kalender. Doelbuffer 48u (min 24 / max 72).</p>

      {gated && <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-3 text-[12px] text-amber-200/80">Horizon-views nog niet toegepast (migratie 166). Geen data beschikbaar.</div>}

      {/* Niche-momentum: wie wint/verliest marktaandeel */}
      {!gated && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55"><Flame size={13} className="text-orange-400" /> Marktaandeel per niche (live)</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {moms.length === 0 && <Empty />}
            {moms.map((m) => {
              const up = m.momentum === 'wint', down = m.momentum === 'verliest'
              const c = up ? '#22c55e' : down ? '#ef4444' : '#64748b'
              const Icon = up ? TrendingUp : down ? TrendingDown : Minus
              return (
                <div key={m.niche} className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-white/80">{catLabel(m.niche)}</span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase" style={{ color: c }}><Icon size={11} /> {m.momentum}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-white/45">
                    <span>virality {m.vir_recent}{m.vir_prior != null && <span className="text-white/30"> ← {m.vir_prior}</span>}</span>
                    <span className="ml-auto">{m.n_recent} signalen</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Geplande productie (gated planner) */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55"><CalendarClock size={13} className="text-violet-400" /> Geplande video&apos;s (overmorgen)</div>
        {plans.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#0e1525] p-4 text-[12px] text-white/45">
            Geen data beschikbaar — de horizon-planner is gated (engine <code className="text-white/60">content:horizon-planner</code> staat uit). Zodra aangezet verschijnen hier geplande video&apos;s met confidence, verwachte impact en bron-winnaar.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
                <div className="text-[11px] font-medium text-white line-clamp-2">{p.title_draft}</div>
                <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] text-white/45">
                  <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {p.planned_publish_at ? new Date(p.planned_publish_at).toLocaleString('nl-NL', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  <span className="text-emerald-400/70">confidence {p.confidence != null ? `${p.confidence}` : '—'}</span>
                  <span>verw. views {p.expected_views != null ? compact(p.expected_views) : 'Geen data'}</span>
                  <span className="text-white/30">verw. subs Geen data</span>
                </div>
                {p.reason && <div className="mt-1 text-[9px] text-white/40 line-clamp-2">{p.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viral-candidates: wat wint nu → produceer variant */}
      {!gated && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55"><Flame size={13} className="text-red-400" /> Wint nu (produceer variant)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {cands.length === 0 && <Empty />}
            {cands.map((c) => (
              <a key={c.id} href={c.url ?? '#'} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-white/8 bg-[#0e1525] transition-all hover:-translate-y-0.5 hover:border-white/25">
                <CreativePreview preview={resolvePreview(null, null, c.thumbnail_url)} ratio="video" />
                <div className="p-2">
                  <div className="text-[10px] font-medium text-white line-clamp-2">{c.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[8px] text-white/40">
                    <span className="text-orange-400/80">vir {c.virality_score}</span>
                    <span>{compact(c.views)} views</span>
                    <span className="ml-auto">{catLabel(c.niche)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Empty() {
  return <div className="col-span-full rounded-lg border border-white/10 bg-[#0e1525] p-4 text-[12px] text-white/40">Geen data beschikbaar</div>
}
