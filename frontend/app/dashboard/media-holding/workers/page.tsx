'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

type Worker = {
  id: string
  name: string
  kind: string
  status: string
  last_seen: string | null
  queue_depth: number
  last_error: string | null
}

const STATUS_COLORS: Record<string, string> = {
  idle:    'bg-emerald-500/10 text-emerald-300',
  running: 'bg-amber-500/10 text-amber-300',
  paused:  'bg-white/[0.06] text-white/55',
  offline: 'bg-white/[0.06] text-white/40',
  error:   'bg-red-500/10 text-red-400',
}

function fmtAge(iso: string | null): string {
  if (!iso) return '—'
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s geleden`
  if (sec < 3600) return `${Math.floor(sec / 60)}m geleden`
  return `${Math.floor(sec / 3600)}u geleden`
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/media-holding/workers')
      .then((r) => (r.ok ? r.json() : { workers: [] }))
      .then((j) => { setWorkers(j.workers ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Users size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Workers</h1>
          <p className="text-xs text-white/50">Health en queue depth per Media Holding worker.</p>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : workers.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Users size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Geen workers geregistreerd.</p>
        </div>
      ) : (
        <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Naam</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Queue</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Laatste activiteit</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Laatste fout</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-xs text-white/85">{w.name}</td>
                  <td className="px-4 py-3 text-xs text-white/55">{w.kind}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[w.status] ?? STATUS_COLORS.offline)}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/65">{w.queue_depth}</td>
                  <td className="px-4 py-3 text-xs text-white/55">{fmtAge(w.last_seen)}</td>
                  <td className="px-4 py-3 text-xs text-red-400/80 max-w-[300px] truncate">{w.last_error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
