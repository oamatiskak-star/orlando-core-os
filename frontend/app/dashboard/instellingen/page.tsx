import { Settings, Globe, Key, Bell, AlertTriangle, Copy, ExternalLink } from 'lucide-react'

const apiKeys = [
  {
    service: 'Supabase URL',
    value: 'https://pmovazftwoxjopqkuuhp.supabase.co',
    status: 'Actief',
    action: 'Kopieer',
  },
  {
    service: 'Supabase Anon Key',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...N89I',
    status: 'Actief',
    action: 'Kopieer',
  },
  {
    service: 'GitHub',
    value: 'Connected as oamatiskak-star',
    status: 'Actief',
    action: 'Beheer',
  },
]

const notificaties = [
  { label: 'E-mail alerts', desc: 'Ontvang kritieke meldingen per e-mail', enabled: true },
  { label: 'Telegram alerts', desc: 'Stuur meldingen naar Telegram bot', enabled: false },
  { label: 'Agent fouten', desc: 'Meld fouten van alle AI-agents', enabled: true },
  { label: 'Systeem meldingen', desc: 'Deploy events, sync status en health alerts', enabled: true },
]

export default function InstellingenPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-500/10 border border-gray-500/20 flex items-center justify-center">
          <Settings size={16} className="text-gray-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Instellingen</h1>
          <p className="text-xs text-white/30">Platforminstellingen, API-sleutels en configuratie.</p>
        </div>
      </div>

      {/* Platform */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={14} className="text-white/40" />
          <h2 className="text-sm font-semibold text-white">Platform</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'App naam', value: 'Orlando Core OS' },
            { label: 'URL', value: 'dashboard.strkbeheer.nl' },
            { label: 'Tijdzone', value: 'Europe/Amsterdam (UTC+2)' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[11px] text-white/30 mb-1">{item.label}</p>
              <p className="text-xs text-white/70 font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={14} className="text-white/40" />
          <h2 className="text-sm font-semibold text-white">API Sleutels</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Service</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Sleutel</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Actie</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-white/70 font-medium">{row.service}</td>
                  <td className="px-4 py-3 text-xs text-white/40 font-mono max-w-[260px] truncate">{row.value}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="flex items-center gap-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      {row.action === 'Kopieer' ? <Copy size={10} /> : <ExternalLink size={10} />}
                      {row.action}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notificaties */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={14} className="text-white/40" />
          <h2 className="text-sm font-semibold text-white">Notificaties</h2>
        </div>
        <div className="space-y-3">
          {notificaties.map((n) => (
            <div key={n.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-xs text-white/70 font-medium">{n.label}</p>
                <p className="text-[11px] text-white/30">{n.desc}</p>
              </div>
              <div
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  n.enabled ? 'bg-indigo-600' : 'bg-white/10'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    n.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white/[0.02] border border-red-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-red-400" />
          <h2 className="text-sm font-semibold text-red-400">Gevaarlijke Zone</h2>
        </div>
        <p className="text-[11px] text-white/30 mb-4">
          Deze actie is onomkeerbaar. Alle data, BV-koppelingen en agent-configuraties worden permanent verwijderd.
        </p>
        <button className="border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          Account verwijderen
        </button>
      </div>
    </div>
  )
}
