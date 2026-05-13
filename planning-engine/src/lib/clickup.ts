import axios, { AxiosInstance } from 'axios'
import { logger } from './logger'

const BASE = 'https://api.clickup.com/api/v2'

let _client: AxiosInstance | null = null

function getClient(): AxiosInstance {
  if (!_client) {
    const token = process.env.CLICKUP_API_TOKEN
    if (!token) throw new Error('CLICKUP_API_TOKEN is required')
    _client = axios.create({
      baseURL: BASE,
      headers: { Authorization: token, 'Content-Type': 'application/json' },
    })
  }
  return _client
}

export interface ClickUpTask {
  id: string
  name: string
  status: { status: string }
  priority: { id: string; priority: string } | null
  due_date: string | null
  assignees: Array<{ id: number; username: string }>
  tags: Array<{ name: string }>
  custom_fields: Array<{ id: string; name: string; value: unknown }>
}

export async function getTasks(listId: string): Promise<ClickUpTask[]> {
  const client = getClient()
  const { data } = await client.get(`/list/${listId}/task`, {
    params: { include_closed: false, subtasks: true },
  })
  return data.tasks ?? []
}

export async function createTask(listId: string, payload: {
  name: string
  description?: string
  status?: string
  priority?: number
  due_date?: number
  tags?: string[]
  assignees?: number[]
}): Promise<ClickUpTask> {
  const client = getClient()
  const { data } = await client.post(`/list/${listId}/task`, payload)
  return data
}

export async function updateTask(taskId: string, payload: {
  status?: string
  priority?: number
  due_date?: number
  description?: string
}): Promise<ClickUpTask> {
  const client = getClient()
  const { data } = await client.put(`/task/${taskId}`, payload)
  return data
}

export async function createComment(taskId: string, comment: string): Promise<void> {
  const client = getClient()
  await client.post(`/task/${taskId}/comment`, { comment_text: comment })
}

export async function getSpaceMembers(spaceId: string): Promise<Array<{ id: number; username: string; email: string }>> {
  const client = getClient()
  try {
    const { data } = await client.get(`/space/${spaceId}/member`)
    return data.members ?? []
  } catch {
    return []
  }
}

export async function searchTasks(workspaceId: string, query: string): Promise<ClickUpTask[]> {
  const client = getClient()
  try {
    const { data } = await client.get(`/team/${workspaceId}/task`, {
      params: { query, include_closed: false },
    })
    return data.tasks ?? []
  } catch {
    return []
  }
}

export async function createList(folderId: string, name: string): Promise<{ id: string; name: string }> {
  const client = getClient()
  const { data } = await client.post(`/folder/${folderId}/list`, { name })
  return data
}

export async function getList(listId: string): Promise<{ id: string; name: string; task_count: number }> {
  const client = getClient()
  const { data } = await client.get(`/list/${listId}`)
  return data
}
