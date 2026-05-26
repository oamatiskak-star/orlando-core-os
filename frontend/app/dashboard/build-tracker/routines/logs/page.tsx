import { createClient } from '@/lib/supabase/server'
import type { RoutineAuditLogRow } from '@/lib/routines/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 100

const ACTOR_STYLE: Record<RoutineAuditLogRow['actor'], string> = {
  ai:     'bg-violet-500/10 text-violet-300 border-violet-400/30',
  user:   'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
  system: 'bg-white/[0.04] text-white/50 border-white/10',
}

function fmt(s: string) {
  return new Date(s).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default async function RoutinesLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  let query = supabase
    .from('routine_audit_log')
    .select('id, routine_id, run_id, action, actor, actor_id, detail, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.action) query = query.eq('action', params.action)
  if (params.actor && ['ai', 'user', 'system'].includes(params.actor)) {
    query = query.eq('actor', params.actor)
  }

  const { data, count } = await query
  const rows = (data ?? []) as RoutineAuditLogRow[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-medium text-white/70">Audit log</h2>
            <p className="text-[10px] text-white/40">
              Immutable — UPDATE/DELETE geblokkeerd via PG RULE. Totaal:{' '}
              <span className="tabular-nums text-white/55">{total}</span>
            </p>
          </div>
          <form className="flex gap-2 text-[10px]">
            <input
              name="action"
              defaultValue={params.action ?? ''}
              placeholder="filter action"
              className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-white/80 placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
            <select
              name="actor"
              defaultValue={params.actor ?? ''}
              className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-white/80"
            >
              <option value="">Alle actors</option>
              <option value="ai">AI</option>
              <option value="user">User</option>
              <option value="system">System</option>
            </select>
            <button
              type="submit"
              className="px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/80"
            >
              Filter
            </button>
          </form>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[11px] text-white/40">Geen audit-log rijen{params.action || params.actor ? ' voor dit filter' : ' yet'}.</p>
            <p className="text-[10px] text-white/25 mt-1">Audit-rijen verschijnen zodra een routine wordt gemaakt/uitgevoerd (Fase 2)</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Tijd</th>
                <th className="pb-2 font-medium">Actor</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Routine</th>
                <th className="pb-2 font-medium">Run</th>
                <th className="pb-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04] align-top">
                  <td className="py-1.5 text-[10px] text-white/50 tabular-nums whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="py-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded border ${ACTOR_STYLE[r.actor]}`}>
                      {r.actor}
                    </span>
                  </td>
                  <td className="py-1.5 text-[10.5px] text-white/80 font-mono">{r.action}</td>
                  <td className="py-1.5 text-[10px] text-white/40 font-mono">{r.routine_id?.slice(0, 8) ?? '—'}</td>
                  <td className="py-1.5 text-[10px] text-white/40 font-mono">{r.run_id?.slice(0, 8) ?? '—'}</td>
                  <td className="py-1.5 text-[10px] text-white/55 font-mono leading-snug">
                    <pre className="whitespace-pre-wrap break-all max-w-[420px]">{JSON.stringify(r.detail)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between text-[10px] text-white/45">
            <span>Pagina {page} van {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`?page=${page - 1}${params.action ? `&action=${params.action}` : ''}${params.actor ? `&actor=${params.actor}` : ''}`}
                  className="px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded"
                >
                  ← Vorige
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`?page=${page + 1}${params.action ? `&action=${params.action}` : ''}${params.actor ? `&actor=${params.actor}` : ''}`}
                  className="px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded"
                >
                  Volgende →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
