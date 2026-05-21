/**
 * ClickUp API Client
 * Handles authentication, rate limiting, and basic requests to ClickUp API
 */

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2'
const RATE_LIMIT_DELAY = 100 // ms between requests

interface ClickUpClientConfig {
  apiToken: string
  teamId: string
}

interface ClickUpSpace {
  id: string
  name: string
}

interface ClickUpFolder {
  id: string
  name: string
  space: { id: string }
}

interface ClickUpList {
  id: string
  name: string
  folder: { id: string } | null
}

interface ClickUpTask {
  id: string
  custom_id: string | null
  name: string
  description: string
  priority: { id: string; priority: string } | null
  due_date: string | null
  start_date: string | null
  status: { status: string }
  assigned: Array<{ id: string; username: string }>
  subtasks: Array<any>
  attachments: Array<{ id: string; title: string }>
  custom_fields: Array<any>
}

export class ClickUpClient {
  private apiToken: string
  private teamId: string
  private lastRequestTime = 0

  constructor(config: ClickUpClientConfig) {
    this.apiToken = config.apiToken
    this.teamId = config.teamId
  }

  /**
   * Ensure rate limiting - wait minimum time between requests
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      await new Promise(resolve =>
        setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
      )
    }
    this.lastRequestTime = Date.now()
  }

  /**
   * Make authenticated request to ClickUp API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.rateLimit()

    const url = `${CLICKUP_API_BASE}${endpoint}`
    const headers = {
      Authorization: this.apiToken,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `ClickUp API error: ${response.status} ${error.err || response.statusText}`
      )
    }

    return response.json()
  }

  /**
   * Get all spaces in team
   */
  async getSpaces(): Promise<ClickUpSpace[]> {
    const response = await this.request<{ spaces: ClickUpSpace[] }>(
      `/team/${this.teamId}/space`
    )
    return response.spaces || []
  }

  /**
   * Get folders in a space
   */
  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const response = await this.request<{ folders: ClickUpFolder[] }>(
      `/space/${spaceId}/folder`
    )
    return response.folders || []
  }

  /**
   * Get lists in a folder (or space-level lists)
   */
  async getLists(folderId: string): Promise<ClickUpList[]> {
    const response = await this.request<{ lists: ClickUpList[] }>(
      `/folder/${folderId}/list`
    )
    return response.lists || []
  }

  /**
   * Get space-level lists (when no folders)
   */
  async getSpaceLists(spaceId: string): Promise<ClickUpList[]> {
    const response = await this.request<{ lists: ClickUpList[] }>(
      `/space/${spaceId}/list`
    )
    return response.lists || []
  }

  /**
   * Get tasks in a list
   */
  async getListTasks(
    listId: string,
    archived = false
  ): Promise<ClickUpTask[]> {
    const response = await this.request<{ tasks: ClickUpTask[] }>(
      `/list/${listId}/task?archived=${archived}`
    )
    return response.tasks || []
  }

  /**
   * Check connection - test API token validity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.request<{ team?: { id: string } }>(
        `/team/${this.teamId}`
      )
      return !!response.team
    } catch (error) {
      console.error('ClickUp connection test failed:', error)
      return false
    }
  }
}

/**
 * Create ClickUp client from environment or provided config
 */
export function createClickUpClient(
  apiToken?: string,
  teamId?: string
): ClickUpClient | null {
  const token = apiToken || process.env.CLICKUP_API_TOKEN
  const team = teamId || process.env.CLICKUP_TEAM_ID

  if (!token || !team) {
    console.warn('ClickUp credentials not configured')
    return null
  }

  return new ClickUpClient({
    apiToken: token,
    teamId: team,
  })
}
