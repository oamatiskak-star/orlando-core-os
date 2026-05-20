import { Users, Mail, Phone, Clock } from 'lucide-react'
import { getAcqCrmContacts } from '@/lib/supabase/acquisition'

const TYPE_COLORS: Record<string, string> = {
  eigenaar: 'text-amber-400 bg-amber-500/10',
  makelaar: 'text-sky-400 bg-sky-500/10',
  investeerder: 'text-emerald-400 bg-emerald-500/10',
  aannemer: 'text-orange-400 bg-orange-500/10',
  gemeente: 'text-violet-400 bg-violet-500/10',
  notaris: 'text-indigo-400 bg-indigo-500/10',
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'text-emerald-400 bg-emerald-500/10',
  inactief: 'text-white/40 bg-white/5',
  blacklist: 'text-red-400 bg-red-500/10',
}

export default async function CrmPage() {
  const contacts = await getAcqCrmContacts()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Users size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Acquisitie CRM</h1>
          <p className="text-xs text-white/50">Contacten en opvolging voor acquisitie deals — {contacts.length} contacten</p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Users size={16} className="text-white/20" />
            </div>
            <p className="text-sm text-white/30">Geen CRM contacten</p>
            <p className="text-xs text-white/20 text-center max-w-xs">Voeg contacten toe of laat OutreachAI automatisch contacten aanmaken bij off-market leads</p>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 border-b border-white/5 text-[11px] text-white/40 font-medium">
            <span className="col-span-3">Naam</span>
            <span className="col-span-2">Type</span>
            <span className="col-span-3">Contact</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Laatste contact</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {contacts.map(c => (
              <div key={c.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="col-span-3">
                  <p className="text-xs font-medium text-white">{c.name}</p>
                  {c.company && <p className="text-[10px] text-white/30">{c.company}</p>}
                </div>
                <div className="col-span-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[c.contact_type ?? ''] ?? 'text-white/40 bg-white/5'}`}>
                    {c.contact_type ?? '—'}
                  </span>
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  {c.email && <a href={`mailto:${c.email}`} className="text-white/30 hover:text-indigo-400 transition-colors"><Mail size={11} /></a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="text-white/30 hover:text-white/60 transition-colors"><Phone size={11} /></a>}
                  <span className="text-[11px] text-white/40 truncate">{c.email ?? c.phone ?? '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[c.status] ?? 'text-white/40 bg-white/5'}`}>
                    {c.status}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-1 text-[11px] text-white/30">
                  {c.last_contact ? (
                    <><Clock size={10} /> {new Date(c.last_contact).toLocaleDateString('nl-NL')}</>
                  ) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
