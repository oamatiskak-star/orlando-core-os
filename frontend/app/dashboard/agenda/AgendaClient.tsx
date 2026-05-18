'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Calendar, Link, Settings,
  Film, Scissors, MapPin, Check, X, RefreshCw,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────

type CalEvent = {
  id: string
  title: string
  start: string
  end?: string
  color: string
  source: 'youtube' | 'google' | 'icloud'
  channel?: string
  type?: 'short' | 'longform'
  status?: string
  allDay?: boolean
  location?: string
}

type GCal = {
  id: string
  name: string
  color: string
  primary: boolean
  selected: boolean
}

type ViewMode = 'today' | 'week' | 'month'

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  VermogenTv:         '#6366f1',
  PropertyInvestorTv: '#ec4899',
  VastgoedTv:         '#0ea5e9',
  SpaarTv:            '#10b981',
  CryptoVermogen:     '#f59e0b',
  BeleggingsTv:       '#8b5cf6',
}

const HOUR_START = 6
const HOUR_END   = 23
const TOTAL_HOURS = HOUR_END - HOUR_START
const HOUR_PX = 56   // px per hour

const DAYS_NL = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfWeek(d: Date) {
  const day = new Date(d)
  const dow = day.getDay()
  const diff = dow === 0 ? -6 : 1 - dow // Mon start
  day.setDate(day.getDate() + diff)
  day.setHours(0, 0, 0, 0)
  return day
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function fmt(d: Date) { return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}` }
function fmtTime(d: Date) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }

function eventTop(start: Date) {
  const h = start.getHours() + start.getMinutes() / 60
  return Math.max(0, (h - HOUR_START) / TOTAL_HOURS) * (TOTAL_HOURS * HOUR_PX)
}

function eventHeight(start: Date, end: Date) {
  const durH = (end.getTime() - start.getTime()) / 3_600_000
  return Math.max(22, durH * HOUR_PX)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EventPill({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const start = new Date(ev.start)
  const end   = ev.end ? new Date(ev.end) : new Date(start.getTime() + 30 * 60_000)
  const top    = eventTop(start)
  const height = eventHeight(start, end)
  const isShort = ev.type === 'short'

  return (
    <button
      onClick={onClick}
      className="absolute left-0.5 right-0.5 rounded-md px-1.5 text-left overflow-hidden transition-opacity hover:opacity-90 active:opacity-75 z-10"
      style={{ top, height, backgroundColor: ev.color + '22', borderLeft: `2px solid ${ev.color}` }}
    >
      <p className="text-[9px] font-semibold leading-tight truncate" style={{ color: ev.color }}>
        {isShort && <Scissors size={7} className="inline mr-0.5" />}
        {!isShort && ev.source === 'youtube' && <Film size={7} className="inline mr-0.5" />}
        {ev.title.replace('[Short] ', '')}
      </p>
      {height > 36 && (
        <p className="text-[8px] opacity-60" style={{ color: ev.color }}>{fmtTime(start)}</p>
      )}
    </button>
  )
}

function EventDetail({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const start = new Date(ev.start)
  const end   = ev.end ? new Date(ev.end) : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
            <h3 className="text-sm font-semibold text-white leading-tight">{ev.title.replace('[Short] ','')}</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white flex-shrink-0"><X size={15}/></button>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <p className="text-white/50">
            {start.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})}
            {' · '}
            {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ''}
          </p>
          {ev.channel && (
            <p className="flex items-center gap-1.5 text-white/65">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[ev.channel] ?? ev.color }} />
              {ev.channel}
              {ev.type === 'short' && <span className="text-pink-400">· Short</span>}
              {ev.type === 'longform' && <span className="text-indigo-400">· Long-form</span>}
            </p>
          )}
          {ev.location && (
            <p className="flex items-center gap-1.5 text-white/65"><MapPin size={10}/>{ev.location}</p>
          )}
          {ev.status && ev.source === 'youtube' && (
            <p className="text-white/50">Status: <span className="text-white/50">{ev.status}</span></p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Google Calendar Panel ────────────────────────────────────────────────────

function GoogleCalendarPanel({
  connected, email, calendars, onSave,
}: {
  connected: boolean
  email?: string
  calendars: GCal[]
  onSave: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(calendars.filter(c => c.selected).map(c => c.id)))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(new Set(calendars.filter(c => c.selected).map(c => c.id)))
  }, [calendars])

  async function save() {
    setSaving(true)
    await onSave([...selected])
    setSaving(false)
    setOpen(false)
  }

  function toggle(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  if (!connected) {
    return (
      <a
        href="/api/calendar/google/connect"
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400 hover:bg-blue-500/20 transition-all"
      >
        <Link size={12} />
        Google Agenda koppelen
      </a>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400 hover:bg-green-500/20 transition-all"
      >
        <Check size={12} />
        Google · {email ?? 'Verbonden'}
        <Settings size={10} className="opacity-50" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-40 bg-[#0f0f14] border border-white/10 rounded-xl w-72 shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white">Agenda&apos;s</p>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white"><X size={13}/></button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {calendars.map(cal => (
              <label key={cal.id} className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  className={clsx('w-4 h-4 rounded flex items-center justify-center border transition-all', selected.has(cal.id) ? 'border-transparent' : 'border-white/20 bg-transparent')}
                  style={selected.has(cal.id) ? { backgroundColor: cal.color } : {}}
                >
                  {selected.has(cal.id) && <Check size={9} className="text-white" />}
                </div>
                <input type="checkbox" className="sr-only" checked={selected.has(cal.id)} onChange={() => toggle(cal.id)} />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                <span className="text-xs text-white/60 group-hover:text-white/80 truncate">{cal.name}</span>
                {cal.primary && <span className="text-[9px] text-white/45 ml-auto">primair</span>}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1 border-t border-white/5">
            <button onClick={save} disabled={saving} className="flex-1 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 hover:bg-blue-500/30 transition-all disabled:opacity-50">
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
            <a href="/api/calendar/google/connect" className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/65 hover:text-white text-center transition-all">
              Opnieuw verbinden
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Channel Filter ───────────────────────────────────────────────────────────

function ChannelFilter({
  channels, hidden, onToggle,
}: {
  channels: string[]
  hidden: Set<string>
  onToggle: (ch: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {channels.map(ch => {
        const color  = CHANNEL_COLORS[ch] ?? '#6366f1'
        const active = !hidden.has(ch)
        return (
          <button
            key={ch}
            onClick={() => onToggle(ch)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all"
            style={{
              borderColor: active ? color + '40' : '#ffffff10',
              backgroundColor: active ? color + '15' : 'transparent',
              color: active ? color : '#ffffff30',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? color : '#ffffff20' }} />
            {ch}
          </button>
        )
      })}
    </div>
  )
}

// ─── Week Grid ───────────────────────────────────────────────────────────────

function WeekGrid({ weekStart, events }: { weekStart: Date; events: CalEvent[] }) {
  const [detail, setDetail] = useState<CalEvent | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i)
  const today = new Date(); today.setHours(0,0,0,0)

  const eventsPerDay = days.map(day => {
    const dayStart = new Date(day); dayStart.setHours(0,0,0,0)
    const dayEnd   = new Date(day); dayEnd.setHours(23,59,59,999)
    return events.filter(e => {
      const s = new Date(e.start)
      return s >= dayStart && s <= dayEnd && !e.allDay
    })
  })

  const allDayEvents = days.map(day => {
    const dayStart = new Date(day); dayStart.setHours(0,0,0,0)
    const dayEnd   = new Date(day); dayEnd.setHours(23,59,59,999)
    return events.filter(e => {
      const s = new Date(e.start)
      return e.allDay && s >= dayStart && s <= dayEnd
    })
  })

  return (
    <>
      {detail && <EventDetail ev={detail} onClose={() => setDetail(null)} />}

      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        {/* Day header */}
        <div className="grid border-b border-white/5" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div className="border-r border-white/5" />
          {days.map((day, i) => {
            const isToday = day.getTime() === today.getTime()
            return (
              <div key={i} className={clsx('p-2 text-center border-r border-white/5 last:border-r-0', isToday && 'bg-indigo-500/5')}>
                <p className="text-[10px] text-white/50">{DAYS_NL[day.getDay()]}</p>
                <p className={clsx('text-sm font-semibold mt-0.5', isToday ? 'text-indigo-400' : 'text-white/60')}>
                  {day.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* All-day row */}
        {allDayEvents.some(d => d.length > 0) && (
          <div className="grid border-b border-white/5" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="border-r border-white/5 flex items-center justify-center">
              <span className="text-[9px] text-white/38 rotate-[-90deg]">dag</span>
            </div>
            {allDayEvents.map((dayEvs, i) => (
              <div key={i} className="p-1 border-r border-white/5 last:border-r-0 space-y-0.5">
                {dayEvs.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setDetail(ev)}
                    className="w-full text-left px-1.5 py-0.5 rounded text-[9px] font-medium truncate"
                    style={{ backgroundColor: ev.color + '25', color: ev.color }}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
          <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Time labels */}
            <div className="border-r border-white/5">
              {hours.map(h => (
                <div key={h} className="flex items-start justify-end pr-2" style={{ height: HOUR_PX }}>
                  <span className="text-[9px] text-white/38 -mt-2">{String(h).padStart(2,'0')}:00</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, i) => {
              const isToday = day.getTime() === today.getTime()
              const dayEvs  = eventsPerDay[i]

              return (
                <div
                  key={i}
                  className={clsx('relative border-r border-white/5 last:border-r-0', isToday && 'bg-indigo-500/[0.02]')}
                  style={{ height: (TOTAL_HOURS + 1) * HOUR_PX }}
                >
                  {/* Hour lines */}
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-white/[0.04]"
                      style={{ top: (h - HOUR_START) * HOUR_PX }}
                    />
                  ))}

                  {/* Events */}
                  {dayEvs.map(ev => (
                    <EventPill key={ev.id} ev={ev} onClick={() => setDetail(ev)} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Day Grid ────────────────────────────────────────────────────────────────

function DayGrid({ day, events }: { day: Date; events: CalEvent[] }) {
  const [detail, setDetail] = useState<CalEvent | null>(null)
  const hours   = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i)
  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const isToday = day.getTime() === today.getTime()

  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999)

  const timedEvs   = events.filter(e => !e.allDay && new Date(e.start) >= dayStart && new Date(e.start) <= dayEnd)
  const allDayEvs  = events.filter(e =>  e.allDay && new Date(e.start) >= dayStart && new Date(e.start) <= dayEnd)

  return (
    <>
      {detail && <EventDetail ev={detail} onClose={() => setDetail(null)} />}

      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        {/* Day header */}
        <div className="flex items-center gap-3 p-3 border-b border-white/5">
          <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold', isToday ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60')}>
            {day.getDate()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white capitalize">
              {day.toLocaleDateString('nl-NL', { weekday: 'long' })}
            </p>
            <p className="text-xs text-white/50">
              {day.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="ml-auto text-[11px] text-white/30">{timedEvs.length + allDayEvs.length} events</div>
        </div>

        {/* All-day events */}
        {allDayEvs.length > 0 && (
          <div className="flex flex-wrap gap-1 p-2 border-b border-white/5">
            {allDayEvs.map(ev => (
              <button
                key={ev.id}
                onClick={() => setDetail(ev)}
                className="px-2 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: ev.color + '25', color: ev.color }}
              >
                {ev.title}
              </button>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
          <div className="flex">
            {/* Time labels */}
            <div className="w-14 flex-shrink-0 border-r border-white/5">
              {hours.map(h => (
                <div key={h} className="flex items-start justify-end pr-2" style={{ height: HOUR_PX }}>
                  <span className="text-[9px] text-white/38 -mt-2">{String(h).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            {/* Single column */}
            <div
              className={clsx('flex-1 relative', isToday && 'bg-indigo-500/[0.02]')}
              style={{ height: (TOTAL_HOURS + 1) * HOUR_PX }}
            >
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-white/[0.04]" style={{ top: (h - HOUR_START) * HOUR_PX }} />
              ))}
              {timedEvs.map(ev => (
                <EventPill key={ev.id} ev={ev} onClick={() => setDetail(ev)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({ anchor, events }: { anchor: Date; events: CalEvent[] }) {
  const [detail, setDetail] = useState<CalEvent | null>(null)

  const year  = anchor.getFullYear()
  const month = anchor.getMonth()

  const firstDay  = new Date(year, month, 1)
  const lastDay   = new Date(year, month + 1, 0)
  const gridStart = startOfWeek(firstDay)

  // Always show 6 rows so the grid height is stable
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <>
      {detail && <EventDetail ev={detail} onClose={() => setDetail(null)} />}

      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-white/5">
          {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
            <div key={d} className="p-2 text-center text-[10px] font-medium text-white/40 border-r border-white/5 last:border-r-0">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const isCurrentMonth = day.getMonth() === month
            const isToday        = day.getTime() === today.getTime()
            const dayStart       = new Date(day); dayStart.setHours(0, 0, 0, 0)
            const dayEnd         = new Date(day); dayEnd.setHours(23, 59, 59, 999)

            const dayEvs = events.filter(e => {
              const s = new Date(e.start)
              return s >= dayStart && s <= dayEnd
            })
            const visible = dayEvs.slice(0, 3)
            const more    = dayEvs.length - 3

            // Hide last row if it's entirely outside current month
            const rowStart = days[Math.floor(i / 7) * 7]
            const rowEnd   = days[Math.floor(i / 7) * 7 + 6]
            const rowOutside = rowStart.getMonth() !== month && rowEnd.getMonth() !== month
            if (rowOutside) return null

            return (
              <div
                key={i}
                className={clsx(
                  'min-h-[88px] p-1 border-r border-b border-white/5 last:border-r-0',
                  !isCurrentMonth && 'opacity-30',
                  isToday && 'bg-indigo-500/5',
                )}
              >
                <p className={clsx(
                  'text-[11px] font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full leading-none',
                  isToday ? 'bg-indigo-500 text-white' : 'text-white/50'
                )}>
                  {day.getDate()}
                </p>

                <div className="space-y-0.5">
                  {visible.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setDetail(ev)}
                      className="w-full text-left px-1 py-0.5 rounded text-[8px] font-medium truncate leading-tight"
                      style={{ backgroundColor: ev.color + '25', color: ev.color }}
                    >
                      {!ev.allDay && <span className="opacity-60">{fmtTime(new Date(ev.start))} </span>}
                      {ev.title.replace('[Short] ', '')}
                    </button>
                  ))}
                  {more > 0 && (
                    <p className="text-[8px] text-white/30 pl-1">+{more} meer</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── iCloud Calendar Panel ───────────────────────────────────────────────────

function ICloudCalendarPanel({ initialConnected }: { initialConnected: boolean }) {
  const [open, setOpen]           = useState(false)
  const [connected, setConnected] = useState(initialConnected)
  const [appleId, setAppleId]     = useState('')
  const [appPwd, setAppPwd]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function connect() {
    if (!appleId || !appPwd) { setError('Vul alle velden in'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/calendar/icloud/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apple_id: appleId, app_password: appPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Verbinding mislukt'); return }
      setConnected(true)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-500/10 border border-gray-500/20 rounded-lg text-xs text-gray-300">
        <Check size={12} className="text-green-400" />
        iCloud · {appleId || 'Verbonden'}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-500/10 border border-gray-500/20 rounded-lg text-xs text-gray-400 hover:bg-gray-500/20 transition-all"
      >
        <Link size={12} />
        iCloud Agenda koppelen
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-72 bg-[#0f0f14] border border-white/10 rounded-xl shadow-2xl p-4 space-y-3">
          <p className="text-[11px] text-white/60 leading-relaxed">
            Gebruik een <strong className="text-white/80">app-specifiek wachtwoord</strong> — aanmaken op{' '}
            <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">appleid.apple.com</a>{' '}
            → Beveiliging → App-specifieke wachtwoorden.
          </p>
          <input
            type="email"
            placeholder="orlandoamatiskak@icloud.com"
            value={appleId}
            onChange={e => setAppleId(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            placeholder="App-specifiek wachtwoord (xxxx-xxxx-xxxx-xxxx)"
            value={appPwd}
            onChange={e => setAppPwd(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-1.5 text-xs text-white/50 border border-white/10 rounded-lg">Annuleren</button>
            <button onClick={connect} disabled={saving} className="flex-1 py-1.5 text-xs text-white bg-indigo-600 rounded-lg disabled:opacity-50">
              {saving ? 'Verbinden…' : 'Koppelen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AgendaClient({ initialConnected }: { initialConnected: boolean }) {
  const [view, setView]           = useState<ViewMode>('week')
  const [anchor, setAnchor]       = useState(() => new Date())
  const [events, setEvents]       = useState<CalEvent[]>([])
  const [loading, setLoading]     = useState(true)
  const [calendars, setCalendars] = useState<GCal[]>([])
  const [connected, setConnected] = useState(initialConnected)
  const [email, setEmail]         = useState<string | undefined>()
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set())
  const [hideGoogle, setHideGoogle]   = useState(false)
  const [hideICloud, setHideICloud]   = useState(false)
  const [icloudConnected, setICloudConnected] = useState(false)

  // Compute date range for current view + anchor
  const [rangeStart, rangeEnd] = useMemo<[Date, Date]>(() => {
    const a = new Date(anchor); a.setHours(0, 0, 0, 0)
    if (view === 'today') {
      const end = new Date(a); end.setHours(23, 59, 59, 999)
      return [a, end]
    }
    if (view === 'week') {
      const ws = startOfWeek(a)
      return [ws, addDays(ws, 7)]
    }
    // month
    const ms = new Date(a.getFullYear(), a.getMonth(), 1)
    const me = new Date(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999)
    return [ms, me]
  }, [view, anchor])

  // Navigation label
  const navLabel = useMemo(() => {
    if (view === 'today') {
      return anchor.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (view === 'week') {
      const ws = startOfWeek(anchor)
      return `${fmt(ws)} – ${fmt(addDays(ws, 6))} ${ws.getFullYear()}`
    }
    return anchor.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  }, [view, anchor])

  function navigate(dir: 1 | -1) {
    setAnchor(prev => {
      if (view === 'today') return addDays(prev, dir)
      if (view === 'week')  return addDays(prev, dir * 7)
      const d = new Date(prev); d.setDate(1); d.setMonth(d.getMonth() + dir)
      return d
    })
  }

  function goToday() { setAnchor(new Date()) }

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const qs = `start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`
    const [gRes, iRes] = await Promise.all([
      fetch(`/api/calendar/google/events?${qs}`),
      fetch(`/api/calendar/icloud/events?${qs}`),
    ])
    const [gData, iData] = await Promise.all([gRes.json(), iRes.json()])

    const icloudEvs = (iData.events ?? []).map((e: { id: string; title: string; start: string; end?: string; allDay: boolean; location?: string }) => ({
      ...e,
      source: 'icloud' as const,
      color:  '#ff3b30',
    }))

    setEvents([...(gData.events ?? []), ...icloudEvs])
    setConnected(gData.googleConnected ?? false)
    setICloudConnected(iData.connected ?? false)
    setLoading(false)
  }, [rangeStart, rangeEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCalendars = useCallback(async () => {
    if (!connected) return
    const res = await fetch('/api/calendar/google/calendars')
    const data = await res.json()
    setCalendars(data.calendars ?? [])
    setEmail(data.email)
  }, [connected])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { fetchCalendars() }, [fetchCalendars])

  async function saveCalendars(ids: string[]) {
    await fetch('/api/calendar/google/calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarIds: ids }),
    })
    await fetchEvents()
  }

  function toggleChannel(ch: string) {
    setHiddenChannels(prev => { const s = new Set(prev); s.has(ch) ? s.delete(ch) : s.add(ch); return s })
  }

  const allChannels = [...new Set(events.filter(e => e.source === 'youtube').map(e => e.channel!))]

  const filtered = events.filter(e => {
    if (e.source === 'google' && hideGoogle) return false
    if (e.source === 'icloud' && hideICloud) return false
    if (e.source === 'youtube' && e.channel && hiddenChannels.has(e.channel)) return false
    return true
  })

  const weekStart = startOfWeek(anchor)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <Calendar size={16} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Agenda</h1>
            <p className="text-xs text-white/50 capitalize">{navLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <ICloudCalendarPanel initialConnected={false} />
          <GoogleCalendarPanel
            connected={connected}
            email={email}
            calendars={calendars}
            onSave={saveCalendars}
          />
        </div>
      </div>

      {/* View switcher + navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* View tabs */}
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {(['today', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
                view === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              {v === 'today' ? 'Vandaag' : v === 'week' ? 'Week' : 'Maand'}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-white/10 text-white/65 hover:text-white hover:border-white/20 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-white/70 min-w-[160px] text-center capitalize">{navLabel}</span>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg border border-white/10 text-white/65 hover:text-white hover:border-white/20 transition-all"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={goToday}
            className="px-2 py-1 rounded-lg border border-white/10 text-[10px] text-white/50 hover:text-white hover:border-white/20 transition-all"
          >
            Nu
          </button>
        </div>
      </div>

      {/* Source filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Google toggle */}
        {connected && (
          <button
            onClick={() => setHideGoogle(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all',
              !hideGoogle ? 'border-blue-500/40 bg-blue-500/15 text-blue-400' : 'border-white/10 bg-transparent text-white/30'
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', !hideGoogle ? 'bg-blue-400' : 'bg-white/20')} />
            Google Agenda
          </button>
        )}

        {/* iCloud toggle */}
        {icloudConnected && (
          <button
            onClick={() => setHideICloud(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all',
              !hideICloud ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-white/10 bg-transparent text-white/30'
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full', !hideICloud ? 'bg-red-400' : 'bg-white/20')} />
            iCloud Agenda
          </button>
        )}

        {/* YouTube channel toggles */}
        {allChannels.length > 0 && (
          <ChannelFilter channels={allChannels} hidden={hiddenChannels} onToggle={toggleChannel} />
        )}

        <span className="ml-auto text-[10px] text-white/30">
          {loading ? 'Laden…' : `${filtered.length} events`}
        </span>
      </div>

      {/* Calendar view */}
      {view === 'today' && <DayGrid day={anchor} events={filtered} />}
      {view === 'week'  && <WeekGrid weekStart={weekStart} events={filtered} />}
      {view === 'month' && <MonthGrid anchor={anchor} events={filtered} />}
    </div>
  )
}
