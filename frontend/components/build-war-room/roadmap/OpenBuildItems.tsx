// Open Build Items — niet verstopt in de graaf. Uit v_build_war_room_nodes (build_item).
type Item = {
  node_id: string; label: string | null; status: string | null
  payload: { section?: string; blocker_code?: string; owner?: string } | null
}
const SC: Record<string, string> = { done: '#22c55e', merged: '#22c55e', open: '#f59e0b', draft: '#f59e0b', closed: '#64748b' }

export default function OpenBuildItems({ items }: { items: Item[] }) {
  const top = items.slice(0, 12)
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Open Build Items</span>
        <span className="text-[10px] text-white/35">{items.length}</span>
      </div>
      <div className="space-y-1">
        {top.map((i) => {
          const c = SC[(i.status ?? '').toLowerCase()] ?? '#64748b'
          return (
            <div key={i.node_id} className="flex items-center gap-2 text-[11px]">
              {i.payload?.blocker_code && <span className="rounded bg-red-500/15 px-1 py-0.5 text-[8px] font-bold text-red-400">{i.payload.blocker_code}</span>}
              {i.payload?.section && <span className="text-[9px] text-white/30">{i.payload.section}</span>}
              <span className="flex-1 truncate text-white/70">{i.label}</span>
              {i.payload?.owner && <span className="text-[10px] text-white/35">{i.payload.owner}</span>}
              {i.status && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ color: c, background: `${c}1a` }}>{i.status}</span>}
            </div>
          )
        })}
        {top.length === 0 && <div className="text-[11px] text-white/40">Geen open items.</div>}
      </div>
    </div>
  )
}
