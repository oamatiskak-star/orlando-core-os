'use client'

import { useState } from 'react'
import { Loader2, Rocket, CheckCircle2 } from 'lucide-react'

/**
 * Fase 4 — GO LIVE. referral_code en/of affiliate_link invoeren → programma gaat live.
 * De DB-trigger affiliate_go_live() doet approval + link-activatie + rank + recommendations.
 */
export default function GoLiveForm({
  programId, programName, referralCode, affiliateLink, isActive,
}: {
  programId: string
  programName: string
  referralCode: string | null
  affiliateLink: string | null
  isActive: boolean
}) {
  const [ref, setRef] = useState(referralCode ?? '')
  const [link, setLink] = useState(affiliateLink ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit() {
    if (!ref.trim() && !link.trim()) { setMsg('Vul een referral-code of affiliate-link in.'); return }
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/account-setup/activation/go-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, referralCode: ref.trim() || null, affiliateLink: link.trim() || null }),
      })
      const j = await res.json().catch(() => ({}))
      setMsg(res.ok ? `${programName} is live gezet — approval + links + aanbevelingen draaien.` : `Fout: ${j.error ?? res.status}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">Fase 4 · GO LIVE</p>
        {isActive && <span className="text-[9px] text-emerald-300 inline-flex items-center gap-1"><CheckCircle2 size={10} /> actief</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">referral_code</p>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="bv. ORLANDO10"
            className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30" />
        </div>
        <div>
          <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">affiliate_link</p>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..."
            className="w-full bg-white/[0.06] border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30" />
        </div>
      </div>
      <button onClick={submit} disabled={saving}
        className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-200 text-[11px] font-semibold px-3 py-1.5 rounded-lg">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
        {isActive ? 'Keys bijwerken' : 'GO LIVE'}
      </button>
      {msg && <p className="mt-2 text-[10px] text-white/60">{msg}</p>}
    </div>
  )
}
