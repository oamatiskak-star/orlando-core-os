import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, ChevronLeft, MapPin, ExternalLink, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AgendaItem = {
  id: string
  title: string
  type: string
  starts_at: string
  ends_at: string | null
  location: string | null
  url: string | null
  description: string | null
  status: string
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  meeting:    { label: 'Meeting',   color: 'bg-blue-500/15 text-blue-400' },
  deadline:   { label: 'Deadline',  color: 'bg-orange-500/15 text-orange-400' },
  milestone:  { label: 'Milestone', color: 'bg-violet-500/15 text-violet-400' },
  review:     { label: 'Review',    color: 'bg-cyan-500/15 text-cyan-400' },
  launch:     { label: 'Launch',    color: 'bg-emerald-500/15 text-emerald-400' },
  kickoff:    { label: 'Kickoff',   color: 'bg-fuchsia-500/15 text-fuchsia-400' },
  external:   { label: 'Extern',    color: 'bg-white/10 text-white/60' },
}

function fmt(s: string) {
  return new Date(s).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function dayKey(s: string) {
  return new Date(s).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('aquier_agenda')
    .select('*')
    .order('starts_at', { ascending: true })

  const items = (data ?? []) as AgendaItem[]
  const now = new Date()
  const upcoming = items.filter(i => new Date(i.starts_at) >= now)
  const past = items.filter(i => new Date(i.starts_at) < now).reverse()

  const grouped = new Map<string, AgendaItem[]>()
  upcoming.forEach(i => {
    const k = dayKey(i.starts_at)
    if (!grouped.has(k)) grouped.set(k, [])
    grouped.get(k)!.push(i)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Calendar size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Aquier Agenda</h1>
          <p className="text-xs text-white/50">{upcoming.length} aankomend · {past.length} verleden</p>
        </div>
      </div>

      {/* Upcoming grouped per day */}
      {Array.from(grouped.entries()).map(([day, dayItems]) => (
        <div key={day} className="space-y-2">
          <h2 className="text-[11px] font-semibold text-white/55 uppercase tracking-wide">{day}</h2>
          <div className="space-y-2">
            {dayItems.map(i => {
              const badge = TYPE_BADGE[i.type] ?? TYPE_BADGE.meeting
              return (
                <div key={i.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                    <span className="text-[10.5px] text-white/45 flex items-center gap-1">
                      <Clock size={10} />
                      {fmt(i.starts_at)}{i.ends_at ? ` → ${new Date(i.ends_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/85 font-medium">{i.title}</p>
                  {i.description && <p className="text-[11px] text-white/55 mt-1">{i.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
                    {i.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {i.location}
                      </span>
                    )}
                    {i.url && (
                      <a href={i.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300">
                        <ExternalLink size={10} />
                        link
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {upcoming.length === 0 && (
        <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <Calendar size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/30">Geen aankomende items</p>
        </div>
      )}

      {/* Past collapsed */}
      {past.length > 0 && (
        <details className="bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <summary className="px-4 py-3 cursor-pointer text-[11px] text-white/45 hover:text-white/65">
            Verleden agenda ({past.length})
          </summary>
          <div className="px-4 pb-3 space-y-1.5">
            {past.slice(0, 20).map(i => {
              const badge = TYPE_BADGE[i.type] ?? TYPE_BADGE.meeting
              return (
                <div key={i.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-white/[0.02]">
                  <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${badge.color} flex-shrink-0`}>{badge.label}</span>
                  <span className="text-[11px] text-white/55 flex-1 truncate">{i.title}</span>
                  <span className="text-[10px] text-white/30 flex-shrink-0">{fmt(i.starts_at)}</span>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
