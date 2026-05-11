'use client'

import { Bot, Play, Square, Mail, Clock, Inbox } from 'lucide-react'
import clsx from 'clsx'

const agents = [
  { name: 'Sync Agent', company: 'MODIWÉ', companyColor: '#6366f1', status: 'online', lastRun: '2 min geleden', queue: 0 },
  { name: 'YouTube Agent', company: 'MEDIA', companyColor: '#8b5cf6', status: 'online', lastRun: '14 min geleden', queue: 3 },
  { name: 'Mail Agent', company: 'MODIWÉ', companyColor: '#6366f1', status: 'online', lastRun: '5 min geleden', queue: 12 },
  { name: 'VastgoedScalper', company: 'BEHEER', companyColor: '#0ea5e9', status: 'idle', lastRun: '1u geleden', queue: 0 },
  { name: 'Calculatie Agent', company: 'BOUW', companyColor: '#f59e0b', status: 'idle', lastRun: '3u geleden', queue: 1 },
  { name: 'PDF Generator', company: 'BOUW', companyColor: '#f59e0b', status: 'offline', lastRun: '2d geleden', queue: 0 },
]

const statusDot: Record<string, string> = {
  online: 'bg-green-400',
  idle: 'bg-amber-400',
  offline: 'bg-white/20',
}

const mailQueue = [
  { time: '09:14', van: 'jan.smit@bouwbv.nl', onderwerp: 'Offerte aanvraag — Badkamer renovatie', status: 'Verwerkt' },
  { time: '09:08', van: 'admin@factuurpro.nl', onderwerp: 'Factuur 2026-042 — €4.250,00', status: 'Verwerkt' },
  { time: '08:55', van: 'pieter@aannemers.nl', onderwerp: 'Planning vergadering 14 mei', status: 'In behandeling' },
  { time: '08:30', van: 'info@ingzakelijk.nl', onderwerp: 'Uw maandoverzicht april 2026', status: 'In behandeling' },
  { time: '07:45', van: 'noreply@belastingdienst.nl', onderwerp: 'Herinnering BTW-aangifte Q1 2026', status: 'Wacht' },
]

const statusBadgeClass = (s: string) => {
  if (s === 'Verwerkt') return 'bg-green-500/10 text-green-400'
  if (s === 'In behandeling') return 'bg-amber-500/10 text-amber-400'
  return 'bg-white/5 text-white/30'
}

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Agent OS</h1>
          <p className="text-xs text-white/30">Beheer en monitor alle AI-agents die actief zijn binnen het ecosysteem.</p>
        </div>
      </div>

      {/* Agent Cluster */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Agent Cluster</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300">Alle logs</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <div key={agent.name} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', statusDot[agent.status])} />
                  <span className="text-sm font-medium text-white">{agent.name}</span>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: agent.companyColor + '20', color: agent.companyColor }}
                >
                  {agent.company}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/30">
                <div className="flex items-center gap-1">
                  <Clock size={10} />
                  <span>{agent.lastRun}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Inbox size={10} />
                  <span>Queue: {agent.queue}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {agent.status !== 'offline' ? (
                  <>
                    <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Play size={10} />
                      Start
                    </button>
                    <button className="flex items-center gap-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      <Square size={10} />
                      Stop
                    </button>
                  </>
                ) : (
                  <button className="flex items-center gap-1.5 border border-white/10 text-white/20 text-xs font-medium px-3 py-1.5 rounded-lg cursor-not-allowed" disabled>
                    Offline
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mail Agent Dashboard */}
      <div className="bg-white/[0.03] border border-indigo-500/20 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Mail size={15} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Mail Agent</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/10 text-green-400 tracking-wide">LIVE</span>
              </div>
              <p className="text-[11px] text-white/30">Automatische e-mailverwerking op basis van ingestelde regels.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Vandaag verwerkt', value: '47' },
            { label: 'In wachtrij', value: '12' },
            { label: 'Gefilterd', value: '8' },
            { label: 'Fouten', value: '0' },
          ].map((s) => (
            <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-lg p-3">
              <p className="text-[11px] text-white/30 mb-1">{s.label}</p>
              <p className="text-xl font-semibold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Recente wachtrij</h3>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Tijd</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Van</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Onderwerp</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Actie</th>
                </tr>
              </thead>
              <tbody>
                {mailQueue.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/40 font-mono">{row.time}</td>
                    <td className="px-4 py-3 text-xs text-white/60 max-w-[160px] truncate">{row.van}</td>
                    <td className="px-4 py-3 text-xs text-white/70 max-w-[240px] truncate">{row.onderwerp}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', statusBadgeClass(row.status))}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">Bekijk</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            Handmatig triggeren
          </button>
          <button className="border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            Regels beheren
          </button>
        </div>
      </div>
    </div>
  )
}
