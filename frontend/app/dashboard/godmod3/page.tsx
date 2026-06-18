'use client'

import { Terminal, ExternalLink } from 'lucide-react'

export default function Godmod3Page() {
  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Terminal size={16} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">G0DM0D3</h1>
            <p className="text-xs text-white/50">
              50+ modellen tegelijk · OpenRouter · ULTRAPLINIAN / PARSELTONGUE / PLINY
            </p>
          </div>
        </div>
        <a
          href="/godmod3/index.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
        >
          <ExternalLink size={11} />
          Volledig scherm
        </a>
      </div>

      {/* Iframe */}
      <div className="flex-1 rounded-xl overflow-hidden border border-white/10 min-h-0">
        <iframe
          src="/godmod3/index.html"
          className="w-full h-full"
          style={{ minHeight: '600px' }}
          allow="clipboard-read; clipboard-write"
          title="G0DM0D3 Multi-Model Chat"
        />
      </div>
    </div>
  )
}
