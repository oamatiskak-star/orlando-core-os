import { Upload, ShieldCheck, Play, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import UploadQueue from '../UploadQueue'
import VerificationStatus from '../VerificationStatus'
import RetryMonitor from '../RetryMonitor'

export default async function QueuePage() {
  const supabase = await createClient()
  const [
    { count: queuedCount },
    { count: processingCount },
    { count: liveCount },
    { count: failedCount },
  ] = await Promise.all([
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .in('status', ['queued', 'retrying', 'preparing', 'normalizing']),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .in('status', ['uploading', 'uploaded_pending_processing', 'processing', 'verifying']),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .eq('status', 'verified_live'),
    supabase.from('youtube_upload_queue').select('*', { count: 'exact', head: true })
      .in('status', ['failed', 'manual_review_required']),
  ])

  const stats = [
    { label: 'In Queue',    value: queuedCount ?? 0,     icon: Upload,        color: 'text-sky-400' },
    { label: 'Verwerking',  value: processingCount ?? 0, icon: ShieldCheck,   color: 'text-indigo-400' },
    { label: 'Live',        value: liveCount ?? 0,       icon: Play,          color: 'text-green-400' },
    { label: 'Fouten',      value: failedCount ?? 0,     icon: AlertCircle,   color: (failedCount ?? 0) > 0 ? 'text-red-400' : 'text-white/38' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Upload size={14} className="text-white/65" /> Upload Queue
          </h2>
          <UploadQueue />
        </div>
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={14} className="text-white/65" /> Verificatie Status
          </h2>
          <VerificationStatus />
        </div>
      </div>

      <div className="bg-white/[0.06] border border-red-500/10 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400/70" /> Retry Monitor
          {(failedCount ?? 0) > 0 && (
            <span className="ml-auto px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-medium rounded-full">
              {failedCount} fouten
            </span>
          )}
        </h2>
        <RetryMonitor />
      </div>
    </div>
  )
}
