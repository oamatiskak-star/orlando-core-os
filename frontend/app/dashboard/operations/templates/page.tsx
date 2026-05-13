import { createClient } from '@/lib/supabase/server'
import { Layers, GitBranch, ListChecks, Bot, Zap } from 'lucide-react'
import Link from 'next/link'

type Template = {
  id: string
  naam: string
  omschrijving: string
  category: string
  template_type: string
  template_data: Record<string, unknown>
  is_system: boolean
  icon: string | null
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  workflow: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  routine: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  agent: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  automation: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  workflow: GitBranch,
  routine: ListChecks,
  agent: Bot,
  automation: Zap,
}

const SYSTEM_TEMPLATES: Omit<Template, 'id' | 'created_at'>[] = [
  {
    naam: 'Dagelijkse Rapportage',
    omschrijving: 'Genereer automatisch een dagrapport en stuur per e-mail',
    category: 'reporting',
    template_type: 'routine',
    template_data: { schedule: '0 8 * * *', steps: [{ type: 'db_query', label: 'Data ophalen' }, { type: 'ai_classify', label: 'Rapport genereren' }, { type: 'mail', label: 'Verzenden' }] },
    is_system: true,
    icon: '📊',
  },
  {
    naam: 'Webhook Ontvanger',
    omschrijving: 'Ontvang externe webhooks en verwerk de payload automatisch',
    category: 'integration',
    template_type: 'workflow',
    template_data: { trigger_type: 'webhook', steps: [{ type: 'condition', label: 'Payload valideren' }, { type: 'db_upsert', label: 'Opslaan' }, { type: 'api_call', label: 'Bevestiging sturen' }] },
    is_system: true,
    icon: '🪝',
  },
  {
    naam: 'AI Email Verwerker',
    omschrijving: 'Verwerk inkomende e-mails met AI — classificeer en routeer automatisch',
    category: 'automation',
    template_type: 'agent',
    template_data: { type: 'analyst', capabilities: ['email', 'ai_classify', 'crm_update'] },
    is_system: true,
    icon: '✉️',
  },
  {
    naam: 'CRM Lead Qualifier',
    omschrijving: 'Kwalificeer nieuwe leads automatisch op basis van criteria',
    category: 'crm',
    template_type: 'workflow',
    template_data: { trigger_type: 'event', steps: [{ type: 'ai_score', label: 'Lead scoren' }, { type: 'crm_update', label: 'CRM updaten' }, { type: 'telegram', label: 'Sales notificatie' }] },
    is_system: true,
    icon: '🎯',
  },
  {
    naam: 'Maandelijkse Financiële Afsluiting',
    omschrijving: 'Automatiseer de maandelijkse financiële rapportage en verificatie',
    category: 'finance',
    template_type: 'routine',
    template_data: { schedule: '0 9 1 * *', steps: [{ type: 'api_call', label: 'Moneybird sync' }, { type: 'db_query', label: 'Verificatie' }, { type: 'mail', label: 'Rapport versturen' }] },
    is_system: true,
    icon: '💰',
  },
  {
    naam: 'Systeem Health Check',
    omschrijving: 'Monitor alle systemen elk uur en stuur alert bij problemen',
    category: 'monitoring',
    template_type: 'routine',
    template_data: { schedule: '0 * * * *', steps: [{ type: 'api_call', label: 'Health check' }, { type: 'condition', label: 'Status evalueren' }, { type: 'telegram', label: 'Alert sturen' }] },
    is_system: true,
    icon: '🔍',
  },
]

export default async function TemplatesPage() {
  const supabase = await createClient()

  const { data: dbTemplates } = await supabase
    .from('oc_automation_templates')
    .select('*')
    .order('naam', { ascending: true })

  const allTemplates = [...SYSTEM_TEMPLATES.map((t, i) => ({ ...t, id: `system-${i}`, created_at: '' })), ...(dbTemplates ?? [])]
  const categories = Array.from(new Set(allTemplates.map(t => t.category))).sort()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Layers size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Templates</h1>
          <p className="text-xs text-white/50">Kant-en-klare automatiseringssjablonen — start snel met bewezen patronen</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['workflow', 'routine', 'agent', 'automation'].map(type => {
          const count = allTemplates.filter(t => t.template_type === type).length
          const Icon = TYPE_ICONS[type] ?? Layers
          const [textC, , borderC] = (TYPE_COLORS[type] ?? 'text-white/50 bg-white/5 border-white/5').split(' ')
          return (
            <div key={type} className={`bg-white/[0.06] border ${borderC} rounded-xl p-4`}>
              <Icon size={13} className={`${textC} mb-2`} />
              <p className={`text-xl font-bold ${textC}`}>{count}</p>
              <p className="text-[11px] text-white/50 mt-0.5 capitalize">{type} templates</p>
            </div>
          )
        })}
      </div>

      {categories.map(cat => {
        const catTemplates = allTemplates.filter(t => t.category === cat)
        return (
          <div key={cat}>
            <p className="text-[10px] uppercase tracking-widest text-white/38 font-semibold px-1 mb-3">{cat}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catTemplates.map(template => {
                const Icon = TYPE_ICONS[template.template_type] ?? Layers
                const [textC, bgC, borderC] = (TYPE_COLORS[template.template_type] ?? 'text-white/50 bg-white/5 border-white/5').split(' ')
                return (
                  <div key={template.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/[0.08] transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">{template.icon ?? '⚙️'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{template.naam}</p>
                          {template.is_system && <span className="px-1 py-0.5 rounded bg-indigo-500/10 text-[9px] text-indigo-400">systeem</span>}
                        </div>
                        <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{template.omschrijving}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${textC} ${bgC} ${borderC}`}>
                        <Icon size={10} /> {template.template_type}
                      </span>
                    </div>
                    <div className="flex gap-2 border-t border-white/5 pt-2">
                      <Link
                        href={`/dashboard/operations/${template.template_type === 'workflow' ? 'workflows' : template.template_type === 'routine' ? 'routines' : template.template_type === 'agent' ? 'agents' : 'automations'}`}
                        className="flex-1 text-center py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-xs transition-colors"
                      >
                        Gebruiken
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
