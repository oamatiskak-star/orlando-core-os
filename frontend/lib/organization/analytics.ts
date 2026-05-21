/**
 * Analytics and Statistics
 * Compute metrics from agents, tasks, and workers
 */

interface TaskStats {
  total: number
  new: number
  queued: number
  assigned: number
  running: number
  completed: number
  failed: number
  cancelled: number
  success_rate: number
  average_duration_ms: number | null
  total_by_source: Record<string, number>
  total_by_system: Record<string, number>
  total_by_priority: Record<string, number>
}

interface AgentStats {
  total: number
  active: number
  idle: number
  paused: number
  failed: number
  average_completion_rate: number
  average_active_tasks: number
  most_active: { name: string; tasks: number } | null
}

interface WorkerStats {
  total: number
  online: number
  slow: number
  offline: number
  average_queue_length: number
  total_by_type: Record<string, number>
  busiest_worker: { name: string; queue: number } | null
}

/**
 * Compute task statistics
 */
export function computeTaskStats(tasks: any[]): TaskStats {
  const statusCounts = {
    new: 0,
    queued: 0,
    assigned: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  }

  const sourceMap: Record<string, number> = {}
  const systemMap: Record<string, number> = {}
  const priorityMap: Record<string, number> = {}
  const completedDurations: number[] = []

  for (const task of tasks) {
    // Count status
    statusCounts[task.status as keyof typeof statusCounts]++

    // Count source
    sourceMap[task.source] = (sourceMap[task.source] || 0) + 1

    // Count system
    systemMap[task.system] = (systemMap[task.system] || 0) + 1

    // Count priority
    priorityMap[task.priority] = (priorityMap[task.priority] || 0) + 1

    // Calculate duration for completed tasks
    if (task.started_at && task.finished_at) {
      const duration =
        new Date(task.finished_at).getTime() - new Date(task.started_at).getTime()
      completedDurations.push(duration)
    }
  }

  const completedCount = statusCounts.completed
  const successRate = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0
  const avgDuration =
    completedDurations.length > 0
      ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
      : null

  return {
    total: tasks.length,
    ...statusCounts,
    success_rate: Math.round(successRate * 100) / 100,
    average_duration_ms: avgDuration ? Math.round(avgDuration) : null,
    total_by_source: sourceMap,
    total_by_system: systemMap,
    total_by_priority: priorityMap,
  }
}

/**
 * Compute agent statistics
 */
export function computeAgentStats(agents: any[]): AgentStats {
  const statusCounts = {
    active: 0,
    idle: 0,
    paused: 0,
    failed: 0,
  }

  let totalTasks = 0
  let totalCompletionRate = 0
  let mostActive: { name: string; tasks: number } | null = null
  let maxTasks = 0

  for (const agent of agents) {
    // Count status
    statusCounts[agent.status as keyof typeof statusCounts]++

    // Track most active agent
    const agentTasks = agent.active_tasks_count + agent.completed_tasks_count
    totalTasks += agentTasks

    if (agentTasks > maxTasks) {
      maxTasks = agentTasks
      mostActive = { name: agent.name, tasks: agentTasks }
    }

    // Calculate individual completion rate
    const totalAttempts = agent.active_tasks_count + agent.completed_tasks_count + agent.failed_tasks_count
    if (totalAttempts > 0) {
      totalCompletionRate += agent.completed_tasks_count / totalAttempts
    }
  }

  const avgCompletionRate =
    agents.length > 0 ? (totalCompletionRate / agents.length) * 100 : 0
  const avgActiveTasks = agents.length > 0 ? totalTasks / agents.length : 0

  return {
    total: agents.length,
    ...statusCounts,
    average_completion_rate: Math.round(avgCompletionRate * 100) / 100,
    average_active_tasks: Math.round(avgActiveTasks * 100) / 100,
    most_active: mostActive,
  }
}

/**
 * Compute worker statistics
 */
export function computeWorkerStats(workers: any[]): WorkerStats {
  const typeMap: Record<string, number> = {}
  let onlineCount = 0
  let slowCount = 0
  let offlineCount = 0
  let totalQueueLength = 0
  let busiestWorker: { name: string; queue: number } | null = null
  let maxQueue = 0

  for (const worker of workers) {
    // Count type
    typeMap[worker.worker_type] = (typeMap[worker.worker_type] || 0) + 1

    // Count health status
    if (!worker.heartbeat_age_seconds) {
      offlineCount++
    } else if (worker.heartbeat_age_seconds < 30) {
      onlineCount++
    } else if (worker.heartbeat_age_seconds < 90) {
      slowCount++
    } else {
      offlineCount++
    }

    // Track queue length
    totalQueueLength += worker.queue_length

    // Find busiest worker
    if (worker.queue_length > maxQueue) {
      maxQueue = worker.queue_length
      busiestWorker = { name: worker.worker_name, queue: worker.queue_length }
    }
  }

  const avgQueueLength =
    workers.length > 0 ? Math.round((totalQueueLength / workers.length) * 100) / 100 : 0

  return {
    total: workers.length,
    online: onlineCount,
    slow: slowCount,
    offline: offlineCount,
    average_queue_length: avgQueueLength,
    total_by_type: typeMap,
    busiest_worker: busiestWorker,
  }
}

/**
 * Generate summary report
 */
export function generateSummaryReport(agents: any[], tasks: any[], workers: any[]) {
  const taskStats = computeTaskStats(tasks)
  const agentStats = computeAgentStats(agents)
  const workerStats = computeWorkerStats(workers)

  return {
    timestamp: new Date().toISOString(),
    agents: agentStats,
    tasks: taskStats,
    workers: workerStats,
    health: {
      system_healthy: agentStats.failed === 0 && workerStats.offline === 0,
      warning_signals: [
        ...(agentStats.failed > 0 ? ['Failed agents detected'] : []),
        ...(workerStats.offline > 0 ? ['Offline workers detected'] : []),
        ...(workerStats.slow > 0 ? ['Slow workers detected'] : []),
        ...(taskStats.failed > 0 ? [`${taskStats.failed} failed tasks`] : []),
      ],
    },
  }
}
