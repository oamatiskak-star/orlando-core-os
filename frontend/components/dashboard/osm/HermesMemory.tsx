'use client'

import { useEffect, useState } from 'react'
import { Brain, X, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type MemoryItem = {
  id: string
  title: string
  description: string
  context: string | null
  created_at: string
  conversation_turn: string
}

export default function HermesMemory({ companyId }: { companyId: string }) {
  const supabase = createClient()
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newMemory, setNewMemory] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const { data } = await supabase
          .from('hermes.notifications')
          .select('id, title, description, metadata, created_at, conversation_turn')
          .eq('company_id', companyId)
          .eq('is_memory', true)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10)

        setMemories(
          (data || []).map(m => ({
            id: m.id,
            title: m.title || 'Memory Item',
            description: m.description || '',
            context: m.metadata?.context || null,
            created_at: m.created_at,
            conversation_turn: m.conversation_turn || 'orlando_request',
          }))
        )
      } catch (error) {
        console.error('Error loading memories:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMemories()

    // Subscribe to new memory items
    const channel = supabase
      .channel(`hermes_memory_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'hermes',
          table: 'notifications',
          filter: `company_id=eq.${companyId} and is_memory=eq.true`,
        },
        () => loadMemories()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, supabase])

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemory.trim()) return

    setSubmitting(true)
    try {
      await supabase.rpc('hermes.remember', {
        p_company_id: companyId,
        p_item: newMemory,
      })
      setNewMemory('')
    } catch (error) {
      console.error('Error adding memory:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await supabase
        .from('hermes.notifications')
        .update({ status: 'completed' })
        .eq('id', memoryId)

      setMemories(memories.filter(m => m.id !== memoryId))
    } catch (error) {
      console.error('Error deleting memory:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4 animate-pulse">
        <div className="h-20 bg-white/5 rounded" />
      </div>
    )
  }

  const daysAgo = (dateStr: string) => {
    const days = Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    return `${days}d ago`
  }

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/10 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Hermes Memory</h3>
        <span className="text-[11px] text-white/40 ml-auto">
          {memories.length} item{memories.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add Memory Form */}
      <form onSubmit={handleAddMemory} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMemory}
            onChange={e => setNewMemory(e.target.value)}
            placeholder="Hermes, remember that..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/40"
          />
          <button
            type="submit"
            disabled={submitting || !newMemory.trim()}
            className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
          </button>
        </div>
      </form>

      {/* Memory Items */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {memories.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-4">
            Nothing to remember yet. Build context with Hermes...
          </p>
        ) : (
          memories.map(memory => (
            <div
              key={memory.id}
              className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-purple-300 leading-tight">
                    {memory.title}
                  </p>
                  {memory.description && (
                    <p className="text-[10px] text-white/60 mt-1 leading-relaxed">
                      {memory.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteMemory(memory.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                  title="Remove from memory"
                >
                  <Trash2 size={12} className="text-red-400/60" />
                </button>
              </div>

              {/* Context if present */}
              {memory.context && (
                <p className="text-[9px] italic text-white/50 border-t border-purple-500/10 pt-1.5">
                  Context: {memory.context}
                </p>
              )}

              {/* Timestamp */}
              <p className="text-[9px] text-white/40">{daysAgo(memory.created_at)}</p>
            </div>
          ))
        )}
      </div>

      {/* Tips */}
      <div className="pt-2 border-t border-white/10 text-[10px] text-white/50">
        <p>💡 Tell Hermes what to remember and he'll bring it up when relevant</p>
      </div>
    </div>
  )
}
