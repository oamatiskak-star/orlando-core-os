import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { Inbox, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Lead = {
  id: string
  lead_type: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  status: string
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  nieuw:          'bg-sky-500/15 text-sky-400',
  gecontacteerd:  'bg-amber-500/15 text-amber-400',
  gekwalificeerd: 'bg-violet-500/15 text-violet-400',
  gewonnen:       'bg-emerald-500/15 text-emerald-400',
  afgewezen:      'bg-red-500/15 text-red-400',
}

export default async function LeadsPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const { data } = await supabase.from('v_acq_leads').select('*').eq('fabriek', company.id).limit(100)
  const leads = (data ?? []) as Lead[]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70"><ChevronLeft size={16} /></Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Inbox size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Leads · {company.name}</h1>
          <p className="text-xs text-white/50">{leads.length} aanvragen · inbound lead-generator</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <Inbox size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/40">Nog geen leads</p>
          <p className="text-[10px] text-white/25 mt-1">Aanvragen via het intake-formulier verschijnen hier (POST /api/leads)</p>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/10 rounded-xl divide-y divide-white/5">
          {leads.map((l) => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{l.name ?? l.email ?? l.phone ?? 'Onbekend'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/45">{l.lead_type}</span>
                </div>
                {l.message && <p className="text-xs text-white/55 mt-0.5 line-clamp-2">{l.message}</p>}
                <p className="text-[10px] text-white/30 mt-1">{l.email ?? ''} {l.phone ?? ''} · {new Date(l.created_at).toLocaleString('nl-NL')}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[l.status] ?? 'bg-white/5 text-white/40'}`}>{l.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
