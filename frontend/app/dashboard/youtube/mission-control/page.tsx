import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import {
  Radar, Users2, AlertCircle, CheckCircle, ShieldCheck, Zap, Database,
  Map, BarChart3, ListOrdered, RotateCcw, HardDrive, Activity, ScrollText,
} from 'lucide-react'
import AgentControlPanel  from './AgentControlPanel'
import InfrastructureMap  from './InfrastructureMap'
import QuotaMonitor       from './QuotaMonitor'
import MediaAssetExplorer from './MediaAssetExplorer'
import WorkflowTimeline   from './WorkflowTimeline'
import LiveQueueMonitor   from './LiveQueueMonitor'
import HumanOverridePanel from './HumanOverridePanel'
import RecoveryDashboard  from './RecoveryDashboard'

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export const revalidate = 30

export default async function MissionControlPage() {
  const supabase = await createClient()
  const today    = new Date().toISOString().split('T')[0]

  const [
    { data: workers },
    { data: aiEngines },
    { count: failedCount },
    { count: verifiedToday },
    { count: activeCount },
    { count: queuedTotal },
    { data: channels },
  ] = await Promise.all([
    supabase.from('worker_registry').select('id, status'),
    supabase.from('ai_worker_status').select('engine, online'),
    supabase.from('youtube_upload_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['failed', 'manual_review_required']),
    supabase.from('youtube_upload_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified_live')
      .gte('updated_at', `${today}T00:00:00Z`),
    supabase.from('youtube_upload_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['preparing', 'normalizing', 'uploading', 'uploaded_pending_processing', 'processing', 'verifying']),
    supabase.from('youtube_upload_queue')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("planned","verified_live","failed","manual_review_required","cancelled")'),
    supabase.from('youtube_channels').select('id, naam, oauth_connected').order('naam'),
  ])

  const onlineWorkers  = (workers ?? []).filter(w => w.status === 'online' || w.status === 'busy').length
  const totalWorkers   = (workers ?? []).length
  const lmOnline       = (aiEngines ?? []).find(a => a.engine === 'lmstudio')?.online ?? false
  const ollamaOnline   = (aiEngines ?? []).find(a => a.engine === 'ollama')?.online ?? false
  const aiOnline       = lmOnline || ollamaOnline

  const statCards = [
    {
      label: 'Workers Online',
      value: `${onlineWorkers}/${totalWorkers}`,
      icon: Users2,
      color: onlineWorkers > 0
        ? 'text-green-400 bg-green-500/10 border-green-500/20'
        : 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    {
      label: 'AI Engine',
      value: aiOnline ? (lmOnline ? 'LM Studio' : 'Ollama') : 'Offline',
      icon: Zap,
      color: aiOnline
        ? 'text-violet-400 bg-violet-500/10 border-violet-500/20'
        : 'text-white/30 bg-white/5 border-white/10',
    },
    {
      label: 'Actieve Uploads',
      value: num(activeCount ?? 0),
      icon: Activity,
      color: (activeCount ?? 0) > 0
        ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
        : 'text-white/40 bg-white/5 border-white/8',
    },
    {
      label: 'Geverifieerd Vandaag',
      value: num(verifiedToday ?? 0),
      icon: CheckCircle,
      color: 'text-green-400 bg-green-500/10 border-green-500/20',
    },
    {
      label: 'Totaal In Pipeline',
      value: num(queuedTotal ?? 0),
      icon: ListOrdered,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: 'Failures',
      value: num(failedCount ?? 0),
      icon: AlertCircle,
      color: (failedCount ?? 0) > 0
        ? 'text-red-400 bg-red-500/10 border-red-500/20'
        : 'text-white/30 bg-white/5 border-white/8',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Radar size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Mission Control</h1>
          <p className="text-xs text-white/50">
            Realtime monitoring — workers · uploads · verificatie · files · recovery
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(failedCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400">
              <AlertCircle size={10} /> {failedCount} failures
            </span>
          )}
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] border ${
            onlineWorkers > 0
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-white/5 border-white/10 text-white/40'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${onlineWorkers > 0 ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
            {onlineWorkers > 0 ? `${onlineWorkers} workers actief` : 'Alle workers offline'}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map(s => {
          const Icon = s.icon
          const [textC, bgC, borderC] = s.color.split(' ')
          return (
            <div key={s.label} className={`bg-white/[0.04] border ${borderC} rounded-xl p-3`}>
              <div className={`w-6 h-6 rounded-lg ${bgC} ${borderC} border flex items-center justify-center mb-2`}>
                <Icon size={12} className={textC} />
              </div>
              <p className={`text-lg font-bold ${textC}`}>{s.value}</p>
              <p className="text-[10px] text-white/45 mt-0.5 leading-tight">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Infrastructure Map */}
      <Section icon={Map} title="Infrastructure Map" subtitle="Realtime status van alle componenten">
        <Suspense fallback={<Skeleton />}>
          <InfrastructureMap />
        </Suspense>
      </Section>

      {/* Agent Control Panel */}
      <Section icon={Users2} title="Agent Control Panel" subtitle="Start · Stop · Restart · Debug workers">
        <Suspense fallback={<Skeleton />}>
          <AgentControlPanel />
        </Suspense>
      </Section>

      {/* Live Queue + Recovery side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section icon={ListOrdered} title="Live Queue Monitor" subtitle="Realtime pipeline status per video">
          <Suspense fallback={<Skeleton />}>
            <LiveQueueMonitor />
          </Suspense>
        </Section>

        <Section icon={RotateCcw} title="Recovery Engine" subtitle="Failures · Retries · Manual review">
          <Suspense fallback={<Skeleton />}>
            <RecoveryDashboard />
          </Suspense>
        </Section>
      </div>

      {/* Workflow Timeline */}
      <Section icon={Activity} title="Workflow Timeline" subtitle="Volledige pipeline stappen per video met audit log">
        <Suspense fallback={<Skeleton />}>
          <WorkflowTimeline />
        </Suspense>
      </Section>

      {/* Media Asset Explorer */}
      <Section icon={HardDrive} title="Media Asset Explorer" subtitle="Fysieke bestanden · render · upload · verificatie per video">
        <Suspense fallback={<Skeleton />}>
          <MediaAssetExplorer />
        </Suspense>
      </Section>

      {/* Human Override + Quota side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Section icon={Zap} title="Human Override Panel" subtitle="Handmatige controle over elke video en worker">
          <Suspense fallback={<Skeleton />}>
            <HumanOverridePanel />
          </Suspense>
        </Section>

        <Section icon={BarChart3} title="YouTube Quota Monitor" subtitle="Dagelijks API quotum per kanaal">
          <Suspense fallback={<Skeleton />}>
            <QuotaMonitor />
          </Suspense>
        </Section>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white/[0.04] border border-white/5 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={13} className="text-white/50" />
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="text-[11px] text-white/40">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-8 bg-white/5 rounded-lg" />
      ))}
    </div>
  )
}
