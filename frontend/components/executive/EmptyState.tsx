import { ReactNode } from 'react'

export function EmptyState({
  icon, title, hint,
}: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center text-white/40">
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium text-white/60">{title}</div>
      {hint ? <div className="text-[11px] mt-1.5 text-white/40 max-w-md">{hint}</div> : null}
    </div>
  )
}
