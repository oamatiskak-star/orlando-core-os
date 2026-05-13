'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MOCK_WORKFLOW_RULES } from '@/lib/finance/mock'
import type { FinWorkflowRule } from '@/lib/finance/types'

const FLOW_STEPS = [
  { dag: '-3', label: 'Pre-herinnering', action: 'E-mail', color: 'border-blue-500/30 text-blue-400' },
  { dag: '+1', label: 'Dag 1 te laat', action: 'E-mail herinnering', color: 'border-amber-500/30 text-amber-400' },
  { dag: '+7', label: 'Dag 7 te laat', action: 'Aanmaning 1', color: 'border-amber-500/40 text-amber-400' },
  { dag: '+14', label: 'Dag 14 te laat', action: 'Aanmaning 2', color: 'border-orange-500/30 text-orange-400' },
  { dag: '+21', label: 'Dag 21 te laat', action: 'Sommatie', color: 'border-red-500/30 text-red-400' },
  { dag: '+30', label: 'Dag 30 te laat', action: 'Incasso', color: 'border-red-600/40 text-red-500' },
]

function triggerLabel(rule: FinWorkflowRule) {
  if (rule.trigger_type === 'days_before_due') return `${rule.trigger_days} dagen voor vervaldatum`
  if (rule.trigger_type === 'days_overdue') return `${rule.trigger_days} dagen te laat`
  return rule.trigger_type
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    send_email: 'E-mail versturen',
    send_reminder: 'Herinnering versturen',
    send_aanmaning: 'Aanmaning versturen',
    send_aanmaning_2: 'Tweede aanmaning versturen',
    send_sommatie: 'Sommatie versturen',
    escalate_incasso: 'Escaleren naar incasso',
    calculate_interest: 'Rente berekenen',
  }
  return map[action] ?? action
}

export default function WorkflowsPage() {
  const [rules, setRules] = useState<FinWorkflowRule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fin_workflow_rules')
          .select('*')
          .order('trigger_days', { ascending: true })

        if (error || !data || data.length === 0) {
          setRules(MOCK_WORKFLOW_RULES)
        } else {
          setRules(data as FinWorkflowRule[])
        }
      } catch {
        setRules(MOCK_WORKFLOW_RULES)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function toggleActive(id: string) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }

  const strkbeheerRules = rules.filter((r) => r.company_id === 'strkbeheer')
  const strkbouwRules = rules.filter((r) => r.company_id === 'strkbouw')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Workflow Automatisering</h1>
          <p className="text-xs text-white/50 mt-0.5">Automatische opvolging per bedrijf. Elke trigger voert een actie uit.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          + Nieuwe Regel
        </button>
      </div>

      {/* Flow diagram */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-white mb-4">Escalatie Flow</h3>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {FLOW_STEPS.map((step, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className={`border ${step.color} rounded-xl p-3 text-center min-w-[100px]`}>
                <p className={`text-xs font-bold ${step.color.split(' ')[1]}`}>Dag {step.dag}</p>
                <p className="text-[10px] text-white/50 mt-1">{step.label}</p>
                <p className="text-[10px] font-medium text-white/70 mt-1">{step.action}</p>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div className="w-6 h-px bg-white/10 flex-shrink-0 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-white/20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-white/50">Laden...</div>
      ) : (
        <>
          {/* STRKBEHEER rules */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <h3 className="text-xs font-semibold text-white">STRKBEHEER</h3>
              <span className="text-[10px] text-white/50">{strkbeheerRules.length} regels</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['#', 'Naam', 'Trigger', 'Actie', 'Status', 'Toggle'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {strkbeheerRules.map((rule, i) => (
                  <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/50">{i + 1}</td>
                    <td className="px-4 py-3 text-xs text-white/70 font-medium">{rule.name}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{triggerLabel(rule)}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{actionLabel(rule.action_type)}</td>
                    <td className="px-4 py-3">
                      {rule.active ? (
                        <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-medium">Actief</span>
                      ) : (
                        <span className="bg-white/5 text-white/50 px-2 py-0.5 rounded-full text-[10px] font-medium">Inactief</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(rule.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${rule.active ? 'bg-indigo-600' : 'bg-white/10'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${rule.active ? 'left-4' : 'left-0.5'}`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* STRKBOUW rules */}
          <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <h3 className="text-xs font-semibold text-white">STRKBOUW</h3>
              <span className="text-[10px] text-white/50">{strkbouwRules.length} regels</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['#', 'Naam', 'Trigger', 'Actie', 'Status', 'Toggle'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {strkbouwRules.map((rule, i) => (
                  <tr key={rule.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/50">{i + 1}</td>
                    <td className="px-4 py-3 text-xs text-white/70 font-medium">{rule.name}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{triggerLabel(rule)}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{actionLabel(rule.action_type)}</td>
                    <td className="px-4 py-3">
                      {rule.active ? (
                        <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-medium">Actief</span>
                      ) : (
                        <span className="bg-white/5 text-white/50 px-2 py-0.5 rounded-full text-[10px] font-medium">Inactief</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(rule.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${rule.active ? 'bg-indigo-600' : 'bg-white/10'}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${rule.active ? 'left-4' : 'left-0.5'}`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
