import axios, { AxiosInstance } from 'axios'

export type ServiceType =
  | 'web_service'
  | 'background_worker'
  | 'cron_job'
  | 'static_site'
  | 'private_service'
  | 'redis'

export type DeployStatus =
  | 'created'
  | 'build_in_progress'
  | 'update_in_progress'
  | 'live'
  | 'deactivated'
  | 'build_failed'
  | 'update_failed'
  | 'canceled'
  | 'pre_deploy_in_progress'
  | 'pre_deploy_failed'

export interface RenderService {
  id: string
  name: string
  type: ServiceType
  suspended: 'suspended' | 'not_suspended'
  updatedAt: string
  ownerId?: string
  serviceDetails?: Record<string, unknown>
}

export interface RenderDeploy {
  id: string
  status: DeployStatus
  trigger?: string
  createdAt: string
  finishedAt?: string
  commit?: { id: string; message: string; createdAt: string }
}

export class RenderClient {
  private http: AxiosInstance

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: 'https://api.render.com/v1',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 20_000
    })
  }

  async listServices(): Promise<RenderService[]> {
    const out: RenderService[] = []
    let cursor: string | undefined
    for (let page = 0; page < 10; page++) {
      const params: Record<string, string | number> = { limit: 100 }
      if (cursor) params.cursor = cursor
      const { data } = await this.http.get<Array<{ service: RenderService; cursor?: string }>>('/services', { params })
      if (!Array.isArray(data) || data.length === 0) break
      for (const row of data) {
        out.push(row.service)
        cursor = row.cursor
      }
      if (data.length < 100) break
    }
    return out
  }

  async listDeploys(serviceId: string, limit = 5): Promise<RenderDeploy[]> {
    const { data } = await this.http.get<Array<{ deploy: RenderDeploy }>>(`/services/${serviceId}/deploys`, {
      params: { limit }
    })
    return data.map((row) => row.deploy)
  }

  async restartService(serviceId: string): Promise<void> {
    await this.http.post(`/services/${serviceId}/restart`)
  }

  async deleteService(serviceId: string): Promise<void> {
    await this.http.delete(`/services/${serviceId}`)
  }

  async suspendService(serviceId: string): Promise<void> {
    await this.http.post(`/services/${serviceId}/suspend`)
  }

  async triggerDeploy(serviceId: string, opts: { clearCache?: boolean } = {}): Promise<RenderDeploy> {
    const body: Record<string, unknown> = {}
    if (opts.clearCache) body.clearCache = 'clear'
    const { data } = await this.http.post<RenderDeploy>(`/services/${serviceId}/deploys`, body)
    return data
  }

  async fetchLogs(opts: {
    ownerId: string
    resourceId: string
    type?: 'build' | 'app'
    limit?: number
    startTime?: Date
    endTime?: Date
  }): Promise<string> {
    const params: Record<string, string | number> = {
      ownerId: opts.ownerId,
      resource: opts.resourceId,
      direction: 'backward',
      limit: opts.limit ?? 60
    }
    if (opts.type) params.type = opts.type
    if (opts.startTime) params.startTime = opts.startTime.toISOString()
    if (opts.endTime) params.endTime = opts.endTime.toISOString()
    const { data } = await this.http.get<{ logs?: Array<{ message: string; timestamp: string }> }>('/logs', { params })
    const lines = (data.logs ?? []).map((l) => `${l.timestamp} ${stripAnsi(l.message)}`)
    return lines.reverse().join('\n')
  }

  async listOwners(): Promise<Array<{ id: string; name: string }>> {
    const { data } = await this.http.get<Array<{ owner: { id: string; name: string } }>>('/owners')
    return data.map((row) => row.owner)
  }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
}
