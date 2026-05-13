import { createClient } from '@/lib/supabase/server'
import { Webhook, Activity, CheckCircle2 } from 'lucide-react'
import WebhookList from './WebhookList'

export default async function WebhooksPage() {
  const supabase = await createClient()

  const [
    { data: webhooks },
    { data: workflows },
  ] = await Promise.all([
    supabase.from('oc_webhooks').select('*').order('naam', { ascending: true }),
    supabase.from('oc_workflows').select('id, naam').eq('status', 'actief').order('naam', { ascending: true }),
  ])

  const actief = webhooks?.filter(w => w.status === 'actief').length ?? 0
  const totalTriggers = webhooks?.reduce((s, w) => s + (w.trigger_count ?? 0), 0) ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Webhook size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Webhooks</h1>
          <p className="text-xs text-white/50">Inkomende webhook endpoints — koppel externe services aan workflows</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totaal', value: webhooks?.length ?? 0, icon: Webhook, color: 'text-indigo-400', border: 'border-indigo-500/20' },
          { label: 'Actief', value: actief, icon: CheckCircle2, color: 'text-green-400', border: 'border-green-500/20' },
          { label: 'Totaal Getriggerd', value: totalTriggers, icon: Activity, color: 'text-sky-400', border: 'border-sky-500/20' },
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

      <WebhookList webhooks={webhooks ?? []} workflows={workflows ?? []} />
    </div>
  )
}
