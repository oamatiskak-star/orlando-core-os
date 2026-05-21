/**
 * Export Utilities
 * Export organization data to various formats
 */

interface ExportOptions {
  filename?: string
}

/**
 * Export agents to CSV
 */
export function exportAgentsToCSV(agents: any[], options: ExportOptions = {}) {
  const filename = options.filename || `agents-${new Date().toISOString().split('T')[0]}.csv`

  const headers = [
    'ID',
    'Name',
    'Type',
    'Role',
    'System',
    'Status',
    'Active Tasks',
    'Completed',
    'Failed',
    'Last Activity',
  ]

  const rows = agents.map(agent => [
    agent.id,
    agent.name,
    agent.agent_type,
    agent.role,
    agent.system,
    agent.status,
    agent.active_tasks_count,
    agent.completed_tasks_count,
    agent.failed_tasks_count,
    agent.last_activity_at ? new Date(agent.last_activity_at).toISOString() : 'Never',
  ])

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

/**
 * Export tasks to CSV
 */
export function exportTasksToCSV(tasks: any[], options: ExportOptions = {}) {
  const filename = options.filename || `tasks-${new Date().toISOString().split('T')[0]}.csv`

  const headers = [
    'ID',
    'Title',
    'Priority',
    'System',
    'Status',
    'Source',
    'Agent',
    'Worker',
    'Created',
    'Started',
    'Finished',
    'Duration (ms)',
    'Error',
  ]

  const rows = tasks.map(task => {
    const duration = task.started_at
      ? new Date(task.finished_at || new Date()).getTime() -
        new Date(task.started_at).getTime()
      : null

    return [
      task.id,
      task.title,
      task.priority,
      task.system,
      task.status,
      task.source,
      task.assigned_agent_id || 'Unassigned',
      task.assigned_worker_id || 'None',
      new Date(task.created_at).toISOString(),
      task.started_at ? new Date(task.started_at).toISOString() : 'Not started',
      task.finished_at ? new Date(task.finished_at).toISOString() : 'Not finished',
      duration,
      task.error || 'None',
    ]
  })

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

/**
 * Export workers to CSV
 */
export function exportWorkersToCSV(workers: any[], options: ExportOptions = {}) {
  const filename = options.filename || `workers-${new Date().toISOString().split('T')[0]}.csv`

  const headers = [
    'ID',
    'Name',
    'Type',
    'Host',
    'Port',
    'Status',
    'Queue Length',
    'Last Heartbeat',
    'Heartbeat Age (s)',
  ]

  const rows = workers.map(worker => [
    worker.id,
    worker.worker_name,
    worker.worker_type,
    worker.host,
    worker.port || 'N/A',
    worker.status,
    worker.queue_length,
    worker.last_heartbeat ? new Date(worker.last_heartbeat).toISOString() : 'Never',
    worker.heartbeat_age_seconds ?? 'Unknown',
  ])

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

/**
 * Export agents to JSON
 */
export function exportAgentsToJSON(agents: any[], options: ExportOptions = {}) {
  const filename = options.filename || `agents-${new Date().toISOString().split('T')[0]}.json`
  const json = JSON.stringify(agents, null, 2)
  downloadFile(json, filename, 'application/json')
}

/**
 * Export tasks to JSON
 */
export function exportTasksToJSON(tasks: any[], options: ExportOptions = {}) {
  const filename = options.filename || `tasks-${new Date().toISOString().split('T')[0]}.json`
  const json = JSON.stringify(tasks, null, 2)
  downloadFile(json, filename, 'application/json')
}

/**
 * Export workers to JSON
 */
export function exportWorkersToJSON(workers: any[], options: ExportOptions = {}) {
  const filename = options.filename || `workers-${new Date().toISOString().split('T')[0]}.json`
  const json = JSON.stringify(workers, null, 2)
  downloadFile(json, filename, 'application/json')
}

/**
 * Helper: Download file to user's device
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
