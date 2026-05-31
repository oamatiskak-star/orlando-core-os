'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { enqueueTask, claimForHost, setTaskStatus, releaseTask } from './actions'

type Host = { host_id: string; label: string; role: string; active: boolean; last_seen_at: string | null }
type Task = {
  id: string; title: string; workstream: string | null; repo: string | null
  target_host: string; priority: number; status: string; claimed_by: string | null
  claimed_at: string | null; created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-white/60 bg-white/[0.06]',
  claimed: 'text-sky-300 bg-sky-500/10',
  running: 'text-amber-300 bg-amber-500/10',
  done: 'text-emerald-300 bg-emerald-500/10',
  failed: 'text-red-300 bg-red-500/10',
  blocked: 'text-fuchsia-300 bg-fuchsia-500/10',
}

export default function DispatchBoard({ hosts, tasks }: { hosts: Host[]; tasks: Task[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', workstream: '', repo: 'orlando-core-os', target_host: 'any', priority: 5 })

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setErr(res.error || 'Mislukt')
      else router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Enqueue */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <div className="text-[12px] font-semibold text-white/85 mb-3">Werk inplannen</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Titel van de taak" className="md:col-span-4 px-2.5 py-1.5 text-[12px] rounded-md bg-white/[0.03] border border-white/10 text-white/90 placeholder:text-white/30" />
          <input value={form.workstream} onChange={(e) => setForm({ ...form, workstream: e.target.value })}
            placeholder="Workstream (P1…)" className="md:col-span-2 px-2.5 py-1.5 text-[12px] rounded-md bg-white/[0.03] border border-white/10 text-white/90 placeholder:text-white/30" />
          <select value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })}
            className="md:col-span-2 px-2.5 py-1.5 text-[12px] rounded-md bg-white/[0.03] border border-white/10 text-white/90">
            <option value="orlando-core-os">orlando-core-os</option>
            <option value="aquire">aquire</option>
          </select>
          <select value={form.target_host} onChange={(e) => setForm({ ...form, target_host: e.target.value })}
            className="md:col-span-2 px-2.5 py-1.5 text-[12px] rounded-md bg-white/[0.03] border border-white/10 text-white/90">
            <option value="any">any</option>
            <option value="cli-l">cli-l</option>
            <option value="cli-r">cli-r</option>
          </select>
          <button type="button" disabled={pending}
            onClick={() => run(() => enqueueTask({ title: form.title, workstream: form.workstream, repo: form.repo, target_host: form.target_host as 'any' | 'cli-l' | 'cli-r', priority: Number(form.priority) }))}
            className="md:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-[12px] rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 disabled:opacity-50">
            {pending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Inplannen
          </button>
        </div>
        {err && <div className="mt-2 text-[11px] text-red-300">{err}</div>}
      </div>

      {/* Claim per host */}
      <div className="flex flex-wrap gap-2">
        {hosts.map((h) => (
          <button key={h.host_id} type="button" disabled={pending}
            onClick={() => run(() => claimForHost(h.host_id as 'cli-l' | 'cli-r'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-white/75 border border-white/10 disabled:opacity-50"
            title={h.label}>
            Claim werk voor <span className="font-mono text-emerald-300">{h.host_id}</span>
          </button>
        ))}
      </div>

      {/* Queue */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-[11.5px]">
          <thead className="text-white/45 bg-white/[0.02]">
            <tr>
              <th className="text-left font-medium px-3 py-2">Taak</th>
              <th className="text-left font-medium px-3 py-2">Stream</th>
              <th className="text-left font-medium px-3 py-2">Host</th>
              <th className="text-left font-medium px-3 py-2">Prio</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-right font-medium px-3 py-2">Acties</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-white/35">Nog geen werk ingepland.</td></tr>
            )}
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-white/[0.05]">
                <td className="px-3 py-2 text-white/85">{t.title}{t.repo && <span className="text-white/35"> · {t.repo}</span>}</td>
                <td className="px-3 py-2 text-white/55">{t.workstream || '—'}</td>
                <td className="px-3 py-2 font-mono text-white/70">{t.claimed_by || t.target_host}</td>
                <td className="px-3 py-2 text-white/55">{t.priority}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLOR[t.status] || 'text-white/60 bg-white/[0.06]'}`}>{t.status}</span></td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {t.status === 'claimed' && (
                      <button type="button" disabled={pending} onClick={() => run(() => setTaskStatus(t.id, 'running'))}
                        className="px-2 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 disabled:opacity-50">Start</button>
                    )}
                    {(t.status === 'claimed' || t.status === 'running') && (
                      <button type="button" disabled={pending} onClick={() => run(() => setTaskStatus(t.id, 'done'))}
                        className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 disabled:opacity-50">Klaar</button>
                    )}
                    {t.status !== 'done' && t.status !== 'queued' && (
                      <button type="button" disabled={pending} onClick={() => run(() => releaseTask(t.id))}
                        className="px-2 py-0.5 text-[10px] rounded bg-white/[0.04] text-white/60 border border-white/10 disabled:opacity-50">Vrijgeven</button>
                    )}
                    {t.status === 'running' && (
                      <button type="button" disabled={pending} onClick={() => run(() => setTaskStatus(t.id, 'failed'))}
                        className="px-2 py-0.5 text-[10px] rounded bg-red-500/10 text-red-300 border border-red-500/20 disabled:opacity-50">Fout</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
