'use client'

import { useEffect, useState, useCallback } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface Agent {
  id: string
  name: string
  agent_type: string
  role: string
  system: string
  status: string
  active_tasks_count: number
  completed_tasks_count: number
  failed_tasks_count: number
  last_activity_at: string
  capabilities: string[]
}

/**
 * Hook for real-time agent updates via Supabase
 */
export function useRealtimeAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Initial load
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/organization/agents?limit=100')
        if (!response.ok) throw new Error('Failed to fetch agents')
        const data = await response.json()
        setAgents(data.agents || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [])

  // Subscribe to real-time updates
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    const subscribe = async () => {
      try {
        channel = supabase
          .channel('organization_agents_realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'organization_agents',
            },
            (payload: any) => {
              if (payload.eventType === 'INSERT') {
                setAgents(prev => [payload.new, ...prev])
              } else if (payload.eventType === 'UPDATE') {
                setAgents(prev =>
                  prev.map(a => (a.id === payload.new.id ? payload.new : a))
                )
              } else if (payload.eventType === 'DELETE') {
                setAgents(prev => prev.filter(a => a.id !== payload.old.id))
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Failed to subscribe to agent updates:', err)
      }
    }

    subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  return { agents, loading, error }
}

interface Task {
  id: string
  title: string
  description: string | null
  priority: string
  system: string
  assigned_agent_id: string | null
  assigned_worker_id: string | null
  status: string
  source: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
}

/**
 * Hook for real-time task updates via Supabase
 */
export function useRealtimeTasks(filters?: {
  status?: string
  source?: string
  agent_id?: string
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Initial load
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (filters?.status) params.append('status', filters.status)
        if (filters?.source) params.append('source', filters.source)
        if (filters?.agent_id) params.append('agent_id', filters.agent_id)
        params.append('limit', '100')

        const response = await fetch(`/api/organization/tasks?${params}`)
        if (!response.ok) throw new Error('Failed to fetch tasks')
        const data = await response.json()
        setTasks(data.tasks || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading tasks')
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [filters?.status, filters?.source, filters?.agent_id])

  // Subscribe to real-time updates
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    const subscribe = async () => {
      try {
        channel = supabase
          .channel('organization_tasks_realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'organization_tasks',
            },
            (payload: any) => {
              if (payload.eventType === 'INSERT') {
                setTasks(prev => [payload.new, ...prev])
              } else if (payload.eventType === 'UPDATE') {
                setTasks(prev =>
                  prev.map(t => (t.id === payload.new.id ? payload.new : t))
                )
              } else if (payload.eventType === 'DELETE') {
                setTasks(prev => prev.filter(t => t.id !== payload.old.id))
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Failed to subscribe to task updates:', err)
      }
    }

    subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  return { tasks, loading, error }
}

interface Worker {
  id: string
  worker_name: string
  worker_type: string
  host: string
  port: number | null
  status: string
  current_task_id: string | null
  queue_length: number
  last_heartbeat: string | null
  heartbeat_age_seconds: number | null
}

/**
 * Hook for real-time worker updates via Supabase
 */
export function useRealtimeWorkers() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Initial load
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/organization/workers?limit=100')
        if (!response.ok) throw new Error('Failed to fetch workers')
        const data = await response.json()
        setWorkers(data.workers || [])
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading workers')
      } finally {
        setLoading(false)
      }
    }

    fetchWorkers()
  }, [])

  // Subscribe to real-time updates
  useEffect(() => {
    let channel: RealtimeChannel | null = null

    const subscribe = async () => {
      try {
        channel = supabase
          .channel('organization_workers_realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'organization_workers',
            },
            (payload: any) => {
              if (payload.eventType === 'INSERT') {
                setWorkers(prev => [payload.new, ...prev])
              } else if (payload.eventType === 'UPDATE') {
                setWorkers(prev =>
                  prev.map(w => (w.id === payload.new.id ? payload.new : w))
                )
              } else if (payload.eventType === 'DELETE') {
                setWorkers(prev => prev.filter(w => w.id !== payload.old.id))
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Failed to subscribe to worker updates:', err)
      }
    }

    subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [supabase])

  return { workers, loading, error }
}
