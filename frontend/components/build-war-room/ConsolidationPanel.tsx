'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Loader2, Check, X, AlertTriangle } from 'lucide-react'

type Entity = { slug: string; name: string }
type Candidate = {
  id: string; entity_slug: string | null; item_a_title: string; item_b_title: string
  similarity: number; confidence: number; source_reason: string; ai_verdict: string | null
  proposed_merge_title: string | null; status: string
}
type Program = { id: string; entity_id: string; label: string; description: string | null; is_proposed: boolean }

export default function ConsolidationPanel({
  entities, candidates, programs,
}: { entities: Entity[]; candidates: Candidate[]; programs: Program[] }) {
  const router = useRouter()
  const [entity, setEntity] = useState(entities[0]?.slug ?? 'all')
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function runConsolidate() {
    setRunning(true); setMsg(null)
    try {
      const res = await fetch('/api/build-tracker/consolidate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity }),
      })
      const json = await res.json()
      setMsg(res.ok ? `${json.note} (${json.candidates} kandidaten, ${json.programs_proposed} programma's)` : `Fout: ${json.error}`)
      startTransition(() => router.refresh())
    } catch (e) {
      setMsg('Netwerkfout bij consolidatie.')
    } finally { setRunning(false) }
  }

  async function decide(payload: object) {
    await fetch('/api/build-tracker/consolidate/decide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-[#0e1525] p-3">
        <Layers size={16} className="text-indigo-400" />
        <span className="text-xs text-white/55">Consolideer roadmap-items voor:</span>
        <select value={entity} onChange={(e) => setEntity(e.target.value)}
          className="rounded border border-white/10 bg-[#070b14] px-2 py-1 text-xs text-white">
          <option value="all">Alle entiteiten</option>
          {entities.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}
        </select>
        <button onClick={runConsolidate} disabled={running}
          className="flex items-center gap-1.5 rounded bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50">
          {running ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
          Consolideer (voorstellen)
        </button>
        <span className="flex items-center gap-1 text-[10px] text-white/35">
          <AlertTriangle size={10} /> propose-only — niets wordt automatisch samengevoegd
        </span>
        {msg && <span className="w-full text-[11px] text-white/50">{msg}</span>}
      </div>

      {/* Programma-voorstellen */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Master-programma&apos;s ({programs.length})</h2>
        {programs.length === 0 && <div className="text-xs text-white/40">Nog geen programma&apos;s. Draai consolidatie om voorstellen te genereren.</div>}
        <div className="grid gap-2 sm:grid-cols-2">
          {programs.map((p) => (
            <div key={p.id} className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">{p.label}</span>
                {p.is_proposed
                  ? <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-400">voorstel</span>
                  : <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-400">bevestigd</span>}
              </div>
              {p.description && <div className="mt-1 text-[11px] text-white/50 line-clamp-2">{p.description}</div>}
              {p.is_proposed && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => decide({ program_id: p.id, decision: 'accepted' })}
                    className="flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25">
                    <Check size={11} /> Bevestig
                  </button>
                  <button onClick={() => decide({ program_id: p.id, decision: 'rejected' })}
                    className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20">
                    <X size={11} /> Wijs af
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Duplicate-voorstellen */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Duplicate-/overlap-voorstellen ({candidates.length})</h2>
        {candidates.length === 0 && <div className="text-xs text-white/40">Geen openstaande voorstellen.</div>}
        {candidates.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] text-white/40">
                <span>{c.entity_slug ?? '—'}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5">{c.source_reason}</span>
                <span className={c.confidence < 0.7 ? 'text-amber-400' : 'text-emerald-400'}>conf {c.confidence}</span>
                {c.ai_verdict && <span className="rounded bg-indigo-400/10 px-1.5 py-0.5 text-indigo-300">{c.ai_verdict}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide({ candidate_id: c.id, decision: 'accepted' })}
                  className="flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/25">
                  <Check size={11} /> Merge-OK
                </button>
                <button onClick={() => decide({ candidate_id: c.id, decision: 'rejected' })}
                  className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20">
                  <X size={11} /> Geen duplicaat
                </button>
              </div>
            </div>
            <div className="mt-1.5 grid gap-1 text-[11px] text-white/70 sm:grid-cols-2">
              <div className="rounded bg-white/[0.03] px-2 py-1 line-clamp-2">A · {c.item_a_title}</div>
              <div className="rounded bg-white/[0.03] px-2 py-1 line-clamp-2">B · {c.item_b_title}</div>
            </div>
            {c.proposed_merge_title && <div className="mt-1 text-[10px] text-indigo-300">→ merge: {c.proposed_merge_title}</div>}
          </div>
        ))}
      </section>
    </div>
  )
}
