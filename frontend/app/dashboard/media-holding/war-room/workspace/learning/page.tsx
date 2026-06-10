import { createClient } from '@/lib/supabase/server'
import { TrendingUp, TrendingDown, Image as ImageIcon, Tv2, Megaphone, Lightbulb } from 'lucide-react'
import { CAT_LABEL, CAT_COLOR, nicheLabel } from '@/lib/war-room/hooks-intel'

export const dynamic = 'force-dynamic'

const num = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

export default async function LearningLoopPage() {
  const supabase = await createClient()
  const [win, lose, hook, thumb, chan, camp] = await Promise.all([
    supabase.from('v_winner_patterns').select('*').limit(12),
    supabase.from('v_loser_patterns').select('*').limit(10),
    supabase.from('v_hook_patterns').select('*').limit(12),
    supabase.from('v_thumbnail_patterns').select('*'),
    supabase.from('v_channel_patterns').select('*').limit(12),
    supabase.from('v_campaign_patterns').select('*').limit(8),
  ])

  if (win.error) {
    return <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">Learning Loop views nog niet toegepast (migratie 173). Geen data beschikbaar.</div>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">Learning Loop — waarom won/verloor content. Patronen uit echte winners/losers; voeden Hook Intelligence, Winner Intelligence en Content Horizon.</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel icon={TrendingUp} title="Winnende patronen" tone="#22c55e">
          {(win.data ?? []).map((r: Record<string, unknown>, i) => (
            <Row key={i} left={<><Cat c={r.category as string} /> <span className="text-white/40">{r.length_bucket as string} · {nicheLabel(r.niche as string)}</span></>}
              right={`${r.n}× · score ${r.avg_score} · ${num(Number(r.avg_views))} v`} />
          ))}
          {(win.data ?? []).length === 0 && <Empty />}
        </Panel>

        <Panel icon={TrendingDown} title="Verliezende patronen" tone="#ef4444">
          {(lose.data ?? []).map((r: Record<string, unknown>, i) => (
            <Row key={i} left={<><Cat c={r.category as string} /> <span className="text-white/40">{r.length_bucket as string} · {nicheLabel(r.niche as string)}</span></>}
              right={`${r.n}×`} />
          ))}
          {(lose.data ?? []).length === 0 && <Empty />}
        </Panel>

        <Panel icon={Lightbulb} title="Hook win-rate" tone="#f59e0b">
          {(hook.data ?? []).map((r: Record<string, unknown>, i) => (
            <Row key={i} left={<><Cat c={r.category as string} /> <span className="text-white/40">{nicheLabel(r.niche as string)}</span></>}
              right={`${r.win_rate ?? '—'}% (${r.winners}/${r.total})`} tone="#34d399" />
          ))}
        </Panel>

        <Panel icon={Tv2} title="Kanaal-patronen" tone="#38bdf8">
          {(chan.data ?? []).map((r: Record<string, unknown>, i) => (
            <Row key={i} left={<span className="text-white/70">{(r.channel as string) ?? '—'}</span>} right={`${r.win_rate ?? '—'}% (${r.winners}/${r.total})`} tone="#34d399" />
          ))}
        </Panel>

        <Panel icon={ImageIcon} title="Thumbnail-patronen" tone="#a855f7">
          {(thumb.data ?? []).map((r: Record<string, unknown>, i) => (
            <Row key={i} left={<span className="text-white/70">{(r.has_thumbnail as boolean) ? 'Met thumbnail' : 'Zonder thumbnail'}</span>}
              right={`${r.win_rate ?? '—'}% win-rate (${r.winners}/${r.total})`} tone="#34d399" />
          ))}
        </Panel>

        <Panel icon={Megaphone} title="Campagne-patronen" tone="#8b5cf6">
          {(camp.data ?? []).map((r: Record<string, unknown>, i) => (
            <Row key={i} left={<span className="capitalize text-white/70">{nicheLabel(r.campaign as string)}</span>} right={`${r.win_rate ?? '—'}% (${r.winners}/${r.total})`} tone="#34d399" />
          ))}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ icon: Icon, title, tone, children }: { icon: typeof Tv2; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone }}><Icon size={13} /> {title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
function Row({ left, right, tone }: { left: React.ReactNode; right: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] pt-1 text-[10px] first:border-0 first:pt-0">
      <span className="flex min-w-0 items-center gap-1 truncate">{left}</span>
      <span className="shrink-0 tabular-nums" style={{ color: tone ?? 'rgba(255,255,255,0.6)' }}>{right}</span>
    </div>
  )
}
function Cat({ c }: { c: string }) {
  return <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ color: CAT_COLOR[c] ?? '#888', background: `${CAT_COLOR[c] ?? '#888'}1a` }}>{CAT_LABEL[c] ?? c}</span>
}
function Empty() { return <div className="text-[10px] italic text-white/30">Geen data beschikbaar</div> }
