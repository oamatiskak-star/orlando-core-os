'use client'

import { useEffect, useState } from 'react'
import { Check, AlertCircle, Loader } from 'lucide-react'

interface ImportStatus {
  configured: boolean
  synced_count: number
  pending_count: number
  error_count: number
}

export default function ClickUpImportPanel() {
  const [status, setStatus] = useState<ImportStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [apiToken, setApiToken] = useState('')
  const [teamId, setTeamId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/organization/clickup/import')
      if (!response.ok) throw new Error('Failed to fetch status')
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading status')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    try {
      setImporting(true)
      setError(null)
      setSuccess(false)

      const response = await fetch('/api/organization/clickup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_token: apiToken || undefined,
          team_id: teamId || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await response.json()
      setSuccess(true)
      setApiToken('')
      setTeamId('')
      await fetchStatus()

      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-center min-h-40">
          <Loader size={20} className="text-white/50 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">ClickUp Import</h2>
        <p className="text-xs text-white/50 mt-1">Import and sync tasks from ClickUp</p>
      </div>

      {status?.configured ? (
        <div className="space-y-4">
          {/* Status Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-xs text-emerald-400 font-semibold">{status.synced_count}</p>
              <p className="text-[10px] text-white/50">Synced</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-xs text-orange-400 font-semibold">{status.pending_count}</p>
              <p className="text-[10px] text-white/50">Pending</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400 font-semibold">{status.error_count}</p>
              <p className="text-[10px] text-white/50">Errors</p>
            </div>
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-2 rounded-lg transition"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size={12} className="animate-spin" />
                Importing...
              </span>
            ) : (
              'Sync ClickUp Tasks Now'
            )}
          </button>

          {/* Optional: Show last sync time */}
          <p className="text-[10px] text-white/40">ClickUp API is configured and ready to sync</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-white/70">ClickUp API Token</label>
            <input
              type="password"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              placeholder="sk_xxx..."
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-white/70">Team ID</label>
            <input
              type="text"
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              placeholder="123456789"
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30"
            />
          </div>

          <button
            onClick={handleImport}
            disabled={!apiToken || !teamId || importing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-2 rounded-lg transition"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader size={12} className="animate-spin" />
                Connecting...
              </span>
            ) : (
              'Connect & Import'
            )}
          </button>

          <p className="text-[10px] text-white/40">
            Get your API token from{' '}
            <a href="https://app.clickup.com/settings/integrations" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
              ClickUp Settings
            </a>
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-2">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex gap-2">
          <Check size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-400">ClickUp import completed successfully!</p>
        </div>
      )}
    </div>
  )
}
