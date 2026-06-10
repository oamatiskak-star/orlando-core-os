import { createClient } from '@/lib/supabase/server'
import { Tv2, Target, Award, Banknote, Lightbulb, Clapperboard, Image as ImageIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Row = {
  channel_id: string; name: string; niche: string | null; status: string | null
  subscribers: number; total_views: number; revenue: number; mode: string
  topics: string[]; own_cta: string[]; content_rules: Record<string, unknown>
  creatives: number; hooks: number; youtube_videos: number; videos_with_thumb: number
}

const MODE = {
  growth:    { label: 'GROWTH',    color: '#38bdf8', icon: Target, hint: 'Bereik winnen' },
  authority: { label: 'AUTHORITY', color: '#a855f7', icon: Award,  hint: 'Autoriteit bouwen' },
  revenue:   { label: 'REVENUE',   color: '#22c55e', icon: Banknote, hint: 'Omzet maximaliseren' },
} as const

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default async function ChannelStrategyPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('v_channel_strategy').select('*').order('total_views', { ascending: false })

  if (error) {
    return <Gated msg="Channel Strategy view nog niet toegepast (migratie 165). Geen data beschikbaar." />
  }
  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return <Gated msg="Geen kanalen gevonden. Geen data beschikbaar." />

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Channel Strategy — per kanaal eigen profiel + mode (growth → authority → revenue, bepaald door bereik). Eigen hooks/winners/thumbnails/CTA&apos;s/regels.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => {
          const m = MODE[(c.mode as keyof typeof MODE)] ?? MODE.growth
          const Icon = m.icon
          return (
            <div key={c.channel_id} className="rounded-lg border border-white/8 bg-[#0e1525] p-4">
              <div className="flex items-center gap-2">
                <Tv2 size={15} className="text-sky-400" />
                <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                <span className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                  style={{ color: m.color, background: `${m.color}1a`, border: `1px solid ${m.color}55` }} title={m.hint}>
                  <Icon size={10} /> {m.label}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-white/40">{c.niche ?? '—'}</div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <S label="subs" value={compact(c.subscribers)} />
                <S label="views" value={compact(c.total_views)} />
                <S label="revenue" value={c.revenue > 0 ? eur(c.revenue) : '—'} accent="#22c55e" />
              </div>

              {c.topics?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.topics.map((t, i) => <span key={i} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-white/55">{t}</span>)}
                </div>
              )}

              <div className="mt-2 grid grid-cols-4 gap-1 border-t border-white/5 pt-2 text-center text-[9px] text-white/45">
                <I icon={Clapperboard} label="creatives" value={c.creatives} />
                <I icon={Lightbulb} label="hooks" value={c.hooks} />
                <I icon={Clapperboard} label="video's" value={c.youtube_videos} />
                <I icon={ImageIcon} label="thumbs" value={c.videos_with_thumb} />
              </div>

              {c.own_cta?.length > 0 && (
                <div className="mt-2 text-[9px] text-white/40">CTA: <span className="text-white/60">{c.own_cta.join(' · ')}</span></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function S({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded bg-white/[0.03] py-1.5"><div className="text-[8px] uppercase tracking-wide text-white/35">{label}</div><div className="text-sm font-semibold" style={{ color: accent ?? '#fff' }}>{value}</div></div>
}
function I({ icon: Icon, label, value }: { icon: typeof Lightbulb; label: string; value: number }) {
  return <div><div className="flex items-center justify-center gap-0.5"><Icon size={9} />{label}</div><div className="text-[11px] font-semibold text-white/70">{value}</div></div>
}
function Gated({ msg }: { msg: string }) {
  return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">{msg}</div>
}
