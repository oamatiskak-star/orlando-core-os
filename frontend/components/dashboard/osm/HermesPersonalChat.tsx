'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, AlertCircle, Loader } from 'lucide-react'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [greeting, setGreeting] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const loadGreeting = async () => {
      try {
        const { data } = await supabase.rpc('generate_daily_greeting', {
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
          .from('hermes.proactive_alerts')
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
          .from('hermes.conversations')
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
    setInput('')
    setResponding(true)

    const newMessage: Message = {
      id: Math.random().toString(),
      speaker: 'orlando',
      message: userMessage,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, newMessage])

    try {
      await supabase.from('hermes.conversations').insert({
        company_id: companyId,
        conversation_date: new Date().toISOString().split('T')[0],
        conversation_time: new Date().toTimeString().split(' ')[0],
        sequence: (messages.length + 1) as any,
        speaker: 'orlando',
        message: userMessage,
        context_type: userMessage.toLowerCase().includes('onthoud') ? 'memory_request' : 'general',
      })

      if (userMessage.toLowerCase().includes('onthoud')) {
        await supabase.rpc('hermes.remember', {
          p_company_id: companyId,
          p_item: userMessage.replace(/onthoud|remember/i, '').trim(),
        })
      }

      const hermesResponse = await generateHermesResponse(userMessage)

      const newHermesMessage: Message = {
        id: Math.random().toString(),
        speaker: 'hermes',
        message: hermesResponse,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, newHermesMessage])

      await supabase.from('hermes.conversations').insert({
        company_id: companyId,
        conversation_date: new Date().toISOString().split('T')[0],
        conversation_time: new Date().toTimeString().split(' ')[0],
        sequence: (messages.length + 2) as any,
        speaker: 'hermes',
        message: hermesResponse,
        context_type: 'hermes_response',
      })
    } catch (error) {
      console.error('Error in conversation:', error)
    } finally {
      setResponding(false)
    }
  }

  const generateHermesResponse = async (input: string): Promise<string> => {
    try {
      if (input.toLowerCase().includes('onthoud')) {
        return `✓ Opgeslagen! Ik herinner je hieraan wanneer relevant.`
      }

      // Call strategic response generation function
      const { data, error } = await supabase.rpc('hermes.generate_strategic_response', {
        p_company_id: companyId,
        p_message: input,
        p_conversation_turn: 'orlando_request',
      })

      if (error) {
        console.error('Error generating strategic response:', error)
        return 'Ik denk hierover na. Wat wil je dat ik eraan doe?'
      }

      return data?.response || 'Begrepen. Wat wil je dat ik eraan doe?'
    } catch (error) {
      console.error('Error in generateHermesResponse:', error)
      return 'Laten we dit stap voor stap aanpakken.'
    }
  }

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl flex flex-col h-[600px] animate-pulse">
        <div className="flex-1 bg-gradient-to-b from-white/5 to-transparent" />
      </div>
    )
  }

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2 bg-gradient-to-r from-white/5 to-transparent">
        <Sparkles size={16} className="text-cyan-400" />
        <h3 className="text-sm font-semibold text-white">Hermes Daily Partner</h3>
      </div>

      {/* Top Alerts Section */}
      {alerts.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5 space-y-2">
          {alerts.slice(0, 2).map(alert => (
            <div
              key={alert.id}
              className={`flex gap-2 p-2 rounded text-xs leading-snug ${
                alert.severity === 'critical'
                  ? 'bg-red-500/10 text-red-200'
                  : 'bg-amber-500/10 text-amber-200'
              }`}
            >
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{alert.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            {greeting && (
              <div className="bg-cyan-500/10 rounded-lg p-4 mb-4 border border-cyan-500/20 max-w-sm">
                <p className="text-sm text-cyan-300">{greeting}</p>
              </div>
            )}
            {!greeting && (
              <div className="space-y-3 text-white/50">
                <p className="text-sm">Welkom! Ik ben Hermes, je strategische partner.</p>
                <p className="text-xs">Vertel me wat er aan de hand is en ik geef advies.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {greeting && messages.length > 0 && (
              <div className="flex justify-center py-2 mb-2">
                <div className="bg-cyan-500/10 rounded-lg px-3 py-2 border border-cyan-500/20 max-w-sm">
                  <p className="text-xs text-cyan-300">{greeting}</p>
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.speaker === 'orlando' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    msg.speaker === 'orlando'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white/10 text-white/90 rounded-bl-none'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            {responding && (
              <div className="flex justify-start">
                <div className="bg-white/10 text-white/50 px-3.5 py-2.5 rounded-lg rounded-bl-none flex items-center gap-2">
                  <Loader size={14} className="animate-spin" />
                  <span className="text-sm">Denkt na...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/5 bg-gradient-to-t from-white/5 to-transparent px-4 py-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={responding}
            placeholder="Zeg iets tegen Hermes..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={responding || !input.trim()}
            className="p-2.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
