'use client'

import { useState } from 'react'
import { Send, Terminal, AlertCircle, ArrowRight } from 'lucide-react'

type Message = {
  id: string
  speaker: 'orlando' | 'hermes'
  message: string
  actions?: { label: string; detail?: string }[]
  suggestions?: string[]
  understood?: boolean
  isError?: boolean
}

const QUICK = [
  'Wat blokkeert omzet vandaag?',
  'Wat is de status van CLI L?',
  'Welke taken staan open?',
  'Ga verder op CLI L en CLI R',
]

let counter = 0
function nextId() {
  counter += 1
  return `m${counter}-${counter * 7919}`
}

export default function HermesPersonalChat({ companyId }: { companyId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [responding, setResponding] = useState(false)

  async function send(text: string) {
    const userMessage = text.trim()
    if (!userMessage || responding) return

    const history = messages.map((m) => ({
      role: m.speaker === 'orlando' ? ('user' as const) : ('assistant' as const),
      content: m.message,
    }))

    setMessages((prev) => [...prev, { id: nextId(), speaker: 'orlando', message: userMessage }])
    setInput('')
    setResponding(true)

    try {
      const res = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, message: userMessage, conversation_history: history }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data) {
        const detail = data?.details || data?.error || `HTTP ${res.status}`
        setMessages((prev) => [
          ...prev,
          { id: nextId(), speaker: 'hermes', message: `Fout: ${detail}`, isError: true },
        ])
        return
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          speaker: 'hermes',
          message: data.reply ?? data.response ?? 'Geen antwoord ontvangen.',
          actions: data.actions ?? [],
          suggestions: data.suggestions ?? [],
          understood: data.understood,
        },
      ])
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'netwerkfout'
      setMessages((prev) => [
        ...prev,
        { id: nextId(), speaker: 'hermes', message: `Verbinding mislukt: ${detail}`, isError: true },
      ])
    } finally {
      setResponding(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Terminal size={16} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Hermes Command Center</h3>
        <span className="text-[10px] text-white/35">— command router voor Orlando Core OS</span>
      </div>

      {/* Chat */}
      <div className="space-y-3 max-h-[340px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-4">
            Geef een opdracht. Bv. &quot;Ga verder op CLI L en CLI R&quot; of &quot;Wat blokkeert omzet vandaag?&quot;
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col gap-1.5 ${msg.speaker === 'orlando' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.speaker === 'orlando'
                    ? 'bg-indigo-500/20 border border-indigo-500/20 text-indigo-200'
                    : msg.isError
                      ? 'bg-red-500/10 border border-red-500/25 text-red-300'
                      : msg.understood === false
                        ? 'bg-amber-500/10 border border-amber-500/25 text-amber-200'
                        : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-200'
                }`}
              >
                {msg.isError && <AlertCircle size={13} className="inline mr-1.5 -mt-0.5" />}
                {msg.message}
              </div>

              {/* Uitgevoerde acties */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                  {msg.actions.map((a, i) => (
                    <span
                      key={i}
                      title={a.detail}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Suggesties (klikbaar) */}
              {msg.speaker === 'hermes' && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                  {msg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => send(s)}
                      disabled={responding}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-white/55 hover:text-white hover:border-cyan-500/40 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <ArrowRight size={9} />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {responding && <p className="text-[11px] text-white/35">Hermes denkt na…</p>}
      </div>

      {/* Quick commands */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={responding}
              className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/10 text-white/55 hover:text-white hover:border-cyan-500/40 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={responding}
          placeholder="Geef Hermes een opdracht…"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={responding || !input.trim()}
          className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </form>

      <p className="text-[11px] text-white/40 text-center">
        💡 Probeer &quot;help&quot; voor alle commando&apos;s · &quot;Onthoud dat…&quot; · &quot;Zet CLI R in auditmodus&quot;
      </p>
    </div>
  )
}
