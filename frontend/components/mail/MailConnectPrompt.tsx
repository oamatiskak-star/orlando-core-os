'use client'

import { Mail, ShieldCheck, Zap, Lock } from 'lucide-react'

export default function MailConnectPrompt() {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 min-h-[80dvh]"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
        <Mail size={28} className="text-indigo-400" />
      </div>

      <h1 className="text-xl font-bold text-white mb-2 text-center">Mail OS</h1>
      <p className="text-sm text-white/40 text-center mb-8 max-w-xs leading-relaxed">
        Verbind je Gmail-account om AI-gestuurde mailverwerking te activeren voor al je bedrijven.
      </p>

      {/* Features */}
      <div className="w-full max-w-xs space-y-3 mb-8">
        {[
          { icon: Zap,         label: 'AI classificeert & prioriteert automatisch' },
          { icon: ShieldCheck, label: 'Spam- en fraudedetectie op facturen' },
          { icon: Lock,        label: 'Jij keurt elk antwoord goed voor verzending' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <Icon size={13} className="text-white/40" />
            </div>
            <p className="text-[12px] text-white/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Connect button */}
      <a
        href="/api/mail/oauth/connect"
        className="w-full max-w-xs flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm py-3.5 rounded-xl transition-colors"
      >
        <Mail size={16} />
        Gmail verbinden
      </a>

      <p className="text-[10px] text-white/25 mt-4 text-center max-w-xs">
        Je geeft lees- en schrijftoegang. Berichten worden nooit automatisch verzonden.
      </p>
    </div>
  )
}
