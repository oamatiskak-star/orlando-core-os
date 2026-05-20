import { Megaphone, Plus, MessageSquare } from 'lucide-react'
import { getAcqOutreachSequences } from '@/lib/supabase/acquisition'
import { createClient } from '@/lib/supabase/server'

const STATUS_COLORS: Record<string, string> = {
  concept: 'text-white/40 bg-white/5',
  actief: 'text-emerald-400 bg-emerald-500/10',
  gepauzeerd: 'text-amber-400 bg-amber-500/10',
  afgerond: 'text-indigo-400 bg-indigo-500/10',
}

const CHANNEL_COLORS: Record<string, string> = {
  email: 'text-sky-400 bg-sky-500/10',
  whatsapp: 'text-emerald-400 bg-emerald-500/10',
  telefoon: 'text-amber-400 bg-amber-500/10',
  linkedin: 'text-indigo-400 bg-indigo-500/10',
  gepland: 'text-white/40 bg-white/5',
  verzonden: 'text-emerald-400 bg-emerald-500/10',
  gelezen: 'text-sky-400 bg-sky-500/10',
  beantwoord: 'text-violet-400 bg-violet-500/10',
  mislukt: 'text-red-400 bg-red-500/10',
}

export default async function OutreachPage() {
  const sequences = await getAcqOutreachSequences()
  const supabase = await createClient()
  const { data: messages } = await supabase
    .from('acq_outreach_messages')
    .select('*, acq_crm_contacts(name), acq_outreach_sequences(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Megaphone size={16} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Outreach Automatie</h1>
            <p className="text-xs text-white/50">AI-gestuurde acquisitie campagnes — {sequences.length} sequences</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sequences */}
        <div className="xl:col-span-2">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Outreach Sequences</p>
          {sequences.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Megaphone size={14} className="text-white/20" />
                <p className="text-xs text-white/30">Geen sequences aangemaakt</p>
                <p className="text-[11px] text-white/20 text-center max-w-xs">OutreachAI genereert automatisch sequences voor off-market leads</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sequences.map(seq => (
                <div key={seq.id} className="bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between hover:border-white/10 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">{seq.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {seq.seq_type && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CHANNEL_COLORS[seq.seq_type] ?? 'text-white/40 bg-white/5'}`}>
                          {seq.seq_type}
                        </span>
                      )}
                      <span className="text-[11px] text-white/30">{seq.step_count} stappen</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {seq.response_rate !== null && (
                      <span className="text-xs text-emerald-400/70">{seq.response_rate.toFixed(1)}% respons</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[seq.status] ?? 'text-white/40 bg-white/5'}`}>
                      {seq.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message queue */}
        <div>
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Berichten Queue</p>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl divide-y divide-white/[0.04]">
            {(!messages || messages.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <MessageSquare size={13} className="text-white/20" />
                <p className="text-[11px] text-white/30">Geen berichten</p>
              </div>
            ) : messages.map((msg: Record<string, unknown>) => (
              <div key={String(msg.id)} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/70 truncate">
                      {(msg.acq_crm_contacts as {name?:string} | null)?.name ?? 'Onbekend'}
                    </p>
                    <p className="text-[10px] text-white/30 truncate">
                      {(msg.acq_outreach_sequences as {name?:string} | null)?.name ?? '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${CHANNEL_COLORS[String(msg.status ?? '')] ?? 'text-white/40 bg-white/5'}`}>
                      {String(msg.status ?? '—')}
                    </span>
                    {msg.channel !== undefined && msg.channel !== null && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${CHANNEL_COLORS[String(msg.channel)] ?? 'text-white/5 text-white/30'}`}>
                        {String(msg.channel)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
