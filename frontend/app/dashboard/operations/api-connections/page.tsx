import { createClient } from '@/lib/supabase/server'
import { PlugZap, CheckCircle2, AlertCircle, Activity } from 'lucide-react'
import ApiConnectionList from './ApiConnectionList'

export default async function ApiConnectionsPage() {
  const supabase = await createClient()

  const { data: connections } = await supabase
    .from('oc_api_connections')
    .select('id, naam, company, service, base_url, auth_type, status, last_tested_at, last_error, created_at')
    .order('naam', { ascending: true })

  const actief = connections?.filter(c => c.status === 'actief').length ?? 0
  const errors = connections?.filter(c => c.status === 'error').length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <PlugZap size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">API Connections</h1>
          <p className="text-xs text-white/50">Externe API koppelingen — OpenAI, Stripe, Moneybird, Twilio en meer</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totaal', value: connections?.length ?? 0, icon: PlugZap, color: 'text-amber-400', border: 'border-amber-500/20' },
          { label: 'Actief', value: actief, icon: CheckCircle2, color: 'text-green-400', border: 'border-green-500/20' },
          { label: 'Fouten', value: errors, icon: AlertCircle, color: errors > 0 ? 'text-red-400' : 'text-white/38', border: errors > 0 ? 'border-red-500/20' : 'border-white/5' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <ApiConnectionList connections={connections ?? []} />
    </div>
  )
}
