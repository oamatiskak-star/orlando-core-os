'use client'

import { useEffect, useState } from 'react'
import { Calendar, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Milestone = {
  code: string
  name: string
  status: 'planned' | 'in_progress' | 'completed'
  priority: 'critical' | 'high' | 'medium'
  month_index: number
  mrr_target_eur: number
  customers_target: number
  current_mrr: number
  current_customers: number
  progress_percentage: number
  is_at_risk: boolean
  days_until_due: number
}

type PlanRisk = {
  milestone_code: string
  milestone_name: string
  risk_type: string
  risk_description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  recommended_action: string
}

export default function HermesBusinessPlan({ companyId }: { companyId: string }) {
  const supabase = createClient()
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [risks, setRisks] = useState<PlanRisk[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPlanData = async () => {
      try {
        const { data: milestonesData, error: milestonesError } = await supabase.rpc(
          'hermes.get_milestone_status',
          { p_company_id: companyId }
        )

        const { data: risksData, error: risksError } = await supabase.rpc(
          'hermes.identify_plan_risks',
          { p_company_id: companyId }
        )

        if (!milestonesError) setMilestones(milestonesData || [])
        if (!risksError) setRisks(risksData || [])
      } catch (error) {
        console.error('Error loading business plan:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlanData()
  }, [companyId, supabase])

  const activeMilestone = milestones.find(m => m.status === 'in_progress')
  const upcomingMilestones = milestones.filter(m => m.status === 'planned').slice(0, 2)
  const criticalRisks = risks.filter(r => r.severity === 'critical' || r.severity === 'high').slice(0, 3)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'text-cyan-400'
      case 'completed':
        return 'text-green-400'
      default:
        return 'text-white/60'
    }
  }

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 border-red-500/30 text-red-300'
      case 'high':
        return 'bg-orange-500/20 border-orange-500/30 text-orange-300'
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
      default:
        return 'bg-green-500/20 border-green-500/30 text-green-300'
    }
  }

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 animate-pulse">
        <div className="h-32 bg-white/5 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Aquier Master Plan</h3>
      </div>

      {/* Active Milestone */}
      {activeMilestone && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-cyan-300">{activeMilestone.code} — EXECUTING</p>
              <p className="text-xs text-white/80 mt-0.5">{activeMilestone.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-cyan-300">{activeMilestone.progress_percentage}%</p>
              <p className="text-[11px] text-white/60">{activeMilestone.days_until_due} days</p>
            </div>
          </div>

          {/* Progress Targets */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
            <div>
              <p className="text-[11px] text-white/50">Revenue Target</p>
              <p className="text-xs font-semibold text-cyan-300">€{activeMilestone.mrr_target_eur.toLocaleString()}</p>
              <p className="text-[10px] text-white/40">Current: €{activeMilestone.current_mrr.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-[11px] text-white/50">Customers</p>
              <p className="text-xs font-semibold text-cyan-300">{activeMilestone.customers_target}</p>
              <p className="text-[10px] text-white/40">Current: {activeMilestone.current_customers}</p>
            </div>
          </div>

          {activeMilestone.is_at_risk && (
            <div className="flex gap-2 items-start pt-2 border-t border-white/10">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5 text-orange-400" />
              <p className="text-[11px] text-orange-300">This milestone is at risk. Action required.</p>
            </div>
          )}
        </div>
      )}

      {/* Upcoming Milestones */}
      {upcomingMilestones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Next Up</p>
          {upcomingMilestones.map(m => (
            <div key={m.code} className="bg-white/5 border border-white/10 rounded-lg p-2.5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white">{m.code}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{m.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-white/60">{m.days_until_due} days</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Critical Risks */}
      {criticalRisks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Risks</p>
          {criticalRisks.map(risk => (
            <div key={`${risk.milestone_code}-${risk.risk_type}`} className={`border rounded-lg p-2.5 ${getRiskColor(risk.severity)}`}>
              <div className="flex gap-2">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold">{risk.milestone_code}</p>
                  <p className="text-[10px] mt-0.5">{risk.risk_description}</p>
                  <p className="text-[10px] mt-1 opacity-80">Action: {risk.recommended_action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
        <div className="bg-white/5 rounded p-2">
          <p className="text-[10px] text-white/50">Completed</p>
          <p className="text-sm font-semibold text-green-400">{milestones.filter(m => m.status === 'completed').length}</p>
        </div>
        <div className="bg-white/5 rounded p-2">
          <p className="text-[10px] text-white/50">Executing</p>
          <p className="text-sm font-semibold text-cyan-400">{milestones.filter(m => m.status === 'in_progress').length}</p>
        </div>
        <div className="bg-white/5 rounded p-2">
          <p className="text-[10px] text-white/50">Planned</p>
          <p className="text-sm font-semibold text-white/60">{milestones.filter(m => m.status === 'planned').length}</p>
        </div>
      </div>

      {/* Tip */}
      <div className="text-[11px] text-white/40">
        <p>📋 Hermes watches your master plan milestones and alerts you to risks.</p>
      </div>
    </div>
  )
}
