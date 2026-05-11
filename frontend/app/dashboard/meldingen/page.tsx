'use client'

import { useState } from 'react'
import { Bell, Bot, Settings, CreditCard, Shield, CheckCheck } from 'lucide-react'
import clsx from 'clsx'

const tabs = ['Alle', 'Ongelezen', 'Agents', 'Systeem', 'Financieel']

const meldingen = [
  {
    type: 'Agent',
    icon: Bot,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/10',
    bericht: 'Mail Agent heeft 12 e-mails verwerkt en 3 gefilterd op spam.',
    tijd: '5 min geleden',
    kleur: 'border-l-green-500/40',
    gelezen: false,
  },
  {
    type: 'Systeem',
    icon: Settings,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/10',
    bericht: 'sync-pull succesvol — 7/7 repositories bijgewerkt.',
    tijd: '10 min geleden',
    kleur: 'border-l-green-500/40',
    gelezen: false,
  },
  {
    type: 'Systeem',
    icon: Settings,
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    bericht: 'Mac Mini 2 sync gestart — initiële configuratie loopt.',
    tijd: '1u geleden',
    kleur: 'border-l-sky-500/40',
    gelezen: false,
  },
  {
    type: 'Auth',
    icon: Shield,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    bericht: 'Nieuwe login gedetecteerd: o.amatiskak@icloud.com — macOS Safari.',
    tijd: '2u geleden',
    kleur: 'border-l-blue-500/40',
    gelezen: true,
  },
  {
    type: 'Agent',
    icon: Bot,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    bericht: 'YouTube Agent wachtrij: 3 videos wachten op upload. Quota: 85%.',
    tijd: '3u geleden',
    kleur: 'border-l-amber-500/40',
    gelezen: true,
  },
  {
    type: 'Financieel',
    icon: CreditCard,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    bericht: 'Vercel Pro — automatische verlenging op 11 jun 2026 (€20,00).',
    tijd: 'Gisteren',
    kleur: 'border-l-purple-500/40',
    gelezen: true,
  },
  {
    type: 'Systeem',
    icon: Settings,
    iconColor: 'text-white/40',
    iconBg: 'bg-white/5',
    bericht: 'Next.js build succesvol — 18 pagina\'s gecompileerd in 34s.',
    tijd: 'Gisteren',
    kleur: 'border-l-white/10',
    gelezen: true,
  },
  {
    type: 'Agent',
    icon: Bot,
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/10',
    bericht: 'Sync Agent voltooid — alle Supabase tabellen gesynchroniseerd.',
    tijd: '2d geleden',
    kleur: 'border-l-green-500/40',
    gelezen: true,
  },
]

const typeBadge = (t: string) => {
  if (t === 'Agent') return 'bg-cyan-500/10 text-cyan-400'
  if (t === 'Auth') return 'bg-blue-500/10 text-blue-400'
  if (t === 'Financieel') return 'bg-purple-500/10 text-purple-400'
  return 'bg-white/5 text-white/40'
}

export default function MeldingenPage() {
  const [activeTab, setActiveTab] = useState('Alle')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Bell size={16} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Meldingen</h1>
            <p className="text-xs text-white/30">Notificaties, alerts en systeem meldingen over alle BV&apos;s.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <CheckCheck size={13} />
          Alles gelezen
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {meldingen.map((m, i) => {
          const Icon = m.icon
          return (
            <div
              key={i}
              className={clsx(
                'bg-white/[0.03] border border-white/5 border-l-2 rounded-xl p-4 flex items-start gap-3 transition-opacity',
                m.kleur,
                m.gelezen && 'opacity-60'
              )}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.iconBg}`}>
                <Icon size={14} className={m.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', typeBadge(m.type))}>
                    {m.type}
                  </span>
                  {!m.gelezen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-white/70 leading-relaxed">{m.bericht}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-[11px] text-white/25 whitespace-nowrap">{m.tijd}</span>
                {!m.gelezen && (
                  <button className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap">
                    Markeer gelezen
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
