'use client'

import { useEffect, useState } from 'react'
import { Send, Sparkles, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  speaker: 'orlando' | 'hermes'
  message: string
  timestamp: string
}

type ProactiveAlert = {
  id: string
  alert_type: string
  description: string
  severity: string
}

export default function HermesPersonalChat({ companyId }: { companyId: string }) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [greeting, setGreeting] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    const loadGreeting = async () => {
      try {
        const { data } = await supabase.schema('hermes').rpc('generate_daily_greeting', {
          p_company_id: companyId,
        })
        setGreeting(data)
      } catch (error) {
        console.error('Error loading greeting:', error)
      }
    }

    const loadAlerts = async () => {
      try {
        const { data } = await supabase
          .schema('hermes')
          .from('proactive_alerts')
          .select('id, alert_type, description, severity')
          .eq('company_id', companyId)
          .is('presented_to_orlando', null)
          .limit(3)

        setAlerts(data || [])
      } catch (error) {
        console.error('Error loading alerts:', error)
      }
    }

    const loadConversations = async () => {
      try {
        const { data } = await supabase
          .schema('hermes')
          .from('conversations')
          .select('id, speaker, message, created_at')
          .eq('company_id', companyId)
          .eq('conversation_date', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: true })
          .limit(20)

        setMessages(
          (data || []).map(m => ({
            id: m.id,
            speaker: m.speaker as 'orlando' | 'hermes',
            message: m.message,
            timestamp: m.created_at,
          }))
        )
      } catch (error) {
        console.error('Error loading conversations:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGreeting()
    loadAlerts()
    loadConversations()
  }, [companyId, supabase])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || responding) return

    const userMessage = input
    const newMessage: Message = {
      id: Math.random().toString(),
      speaker: 'orlando',
      message: userMessage,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, newMessage])
    setInput('')
    setResponding(true)

    try {
      await supabase.schema('hermes').from('conversations').insert({
        company_id: companyId,
        conversation_date: new Date().toISOString().split('T')[0],
        conversation_time: new Date().toTimeString().split(' ')[0],
        sequence: (messages.length + 1) as any,
        speaker: 'orlando',
        message: userMessage,
        context_type: userMessage.toLowerCase().includes('onthoud') ? 'memory_request' : 'general',
      })

      if (userMessage.toLowerCase().includes('onthoud')) {
        await supabase.schema('hermes').rpc('remember', {
          p_company_id: companyId,
          p_item: userMessage,
        })
      }

      const response = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          message: userMessage,
          conversation_history: messages.map(m => ({
            role: m.speaker === 'orlando' ? 'user' : 'assistant',
            content: m.message,
          })),
        }),
      })

      if (!response.ok) throw new Error('Failed to get Hermes response')
      const { response: hermesResponse } = await response.json()

      const newHermesMessage: Message = {
        id: Math.random().toString(),
        speaker: 'hermes',
        message: hermesResponse,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, newHermesMessage])

      await supabase.schema('hermes').from('conversations').insert({
        company_id: companyId,
        conversation_date: new Date().toISOString().split('T')[0],
        conversation_time: new Date().toTimeString().split(' ')[0],
        sequence: (messages.length + 2) as any,
        speaker: 'hermes',
        message: hermesResponse,
        context_type: 'hermes_response',
      })
    } catch (error) {
      console.error('Error in chat:', error)
      const errorMessage: Message = {
        id: Math.random().toString(),
        speaker: 'hermes',
        message: 'Excuseer, ik kon je bericht niet verwerken. Probeer het opnieuw.',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setResponding(false)
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
        <Sparkles size={16} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Hermes Daily Partner</h3>
      </div>

      {/* Greeting */}
      {greeting && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 text-xs text-cyan-300">
          {greeting}
        </div>
      )}

      {/* Proactive Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Alerts</p>
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`flex gap-2 p-2.5 rounded-lg text-xs ${
                alert.severity === 'critical'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
              }`}
            >
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{alert.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chat Area */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-4">Start je dag met Hermes...</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.speaker === 'orlando' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[70%] rounded-lg p-2.5 text-xs leading-relaxed ${
                  msg.speaker === 'orlando'
                    ? 'bg-indigo-500/20 border border-indigo-500/20 text-indigo-200'
                    : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                }`}
              >
                {msg.message}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={responding}
          placeholder="Zeg iets tegen Hermes..."
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

      {/* Tips */}
      <p className="text-[11px] text-white/40 text-center">
        💡 Zeg "Hermes, onthoud dat..." of "status" of "fouten"
      </p>
    </div>
  )
}
