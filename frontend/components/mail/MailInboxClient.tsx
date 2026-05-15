'use client'

import { useEffect, useState } from 'react'
import { Search, RefreshCw, Plus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import MailCard from './MailCard'

type MailMessage = {
  id: string
  subject: string | null
  from_email: string | null
  from_name: string | null
  company: string | null
  category: string | null
  priority: string
  ai_summary: string | null
  received_at: string | null
  is_read: boolean
  threat_detected: boolean
  moneybird_status: string
}

type Filter = 'all' | 'urgent' | 'actie' | 'factuur'

type MailAccount = {
  id: string
  email: string
  display_name: string | null
  sync_status: string
  last_sync_at: string | null
}

interface MailInboxClientProps {
  initialMessages: MailMessage[]
  accounts: MailAccount[]
  urgentCount: number
  highCount: number
  unreadCount: number
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all',     label: 'Alles' },
  { id: 'urgent',  label: 'Urgent' },
  { id: 'actie',   label: 'Actie nodig' },
  { id: 'factuur', label: 'Facturen' },
]

export default function MailInboxClient({
  initialMessages,
  accounts,
  urgentCount,
  highCount,
  unreadCount,
}: MailInboxClientProps) {
  const [messages, setMessages] = useState<MailMessage[]>(initialMessages)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('mail_messages_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mail_messages' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [payload.new as MailMessage, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev =>
              prev.map(m => (m.id === (payload.new as MailMessage).id ? (payload.new as MailMessage) : m))
            )
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = messages.filter(msg => {
    if (filter === 'urgent') return msg.priority === 'urgent' || msg.priority === 'high'
    if (filter === 'actie') return msg.ai_summary && !msg.is_read
    if (filter === 'factuur') return msg.category === 'factuur' || msg.moneybird_status === 'pending'

    if (search) {
      const q = search.toLowerCase()
      return (
        msg.subject?.toLowerCase().includes(q) ||
        msg.from_email?.toLowerCase().includes(q) ||
        msg.from_name?.toLowerCase().includes(q) ||
        msg.ai_summary?.toLowerCase().includes(q)
      )
    }

    return true
  })

  async function triggerSync() {
    setSyncing(true)
    try {
      await fetch('/api/mail/sync', { method: 'POST' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div
      className="max-w-lg mx-auto"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
    >
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">Mail OS</h1>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(s => !s)}
              className="p-2 text-white/40 hover:text-white/70 transition-colors"
            >
              <Search size={18} />
            </button>
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="p-2 text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-0.5">
          {urgentCount > 0 ? (
            <p className="text-[11px] text-red-400">
              {urgentCount} urgent · {highCount} hoog
            </p>
          ) : (
            <p className="text-[11px] text-white/30">{accounts[0]?.email ?? ''}</p>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${accounts[0]?.sync_status === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-[10px] text-white/30">
              {accounts[0]?.sync_status === 'syncing' ? 'Syncing...' : 'Verbonden'}
            </span>
            <Link
              href="/api/mail/oauth/connect"
              className="ml-1 p-1 text-white/20 hover:text-white/50 transition-colors"
              title="Account toevoegen"
            >
              <Plus size={12} />
            </Link>
          </div>
        </div>
      </div>

      {showSearch && (
        <div className="px-4 mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek in mails..."
            autoFocus
            className="w-full bg-[#0d0d1a] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50"
          />
        </div>
      )}

      <div className="flex gap-1 px-4 mb-3 overflow-x-auto scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setSearch('') }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white/[0.06] text-white/50 hover:text-white/70'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-[#0d0d1a] border-t border-white/[0.08]">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-white/25 text-sm">
            {search ? 'Geen mails gevonden' : 'Inbox leeg'}
          </div>
        ) : (
          filtered.map(msg => <MailCard key={msg.id} message={msg} />)
        )}
      </div>
    </div>
  )
}
