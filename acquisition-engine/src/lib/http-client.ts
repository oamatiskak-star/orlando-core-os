import { logger } from './logger'

export interface HttpClientConfig {
  timeout?: number
  retries?: number
  userAgent?: string
}

export class HttpClient {
  private timeout: number
  private retries: number
  private userAgent: string

  constructor(config: HttpClientConfig = {}) {
    this.timeout = config.timeout || 10000
    this.retries = config.retries || 3
    this.userAgent = config.userAgent || 'Orlando-AcquisitionBot/1.0 (+https://orlando.local/scraper)'
  }

  async get<T>(url: string, attempt = 1): Promise<T | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429 && attempt < this.retries) {
          const retryAfter = response.headers.get('Retry-After')
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          logger.warn(`Rate limited. Waiting ${waitMs}ms before retry.`)
          await new Promise(resolve => setTimeout(resolve, waitMs))
          return this.get<T>(url, attempt + 1)
        }

        if (response.status >= 500 && attempt < this.retries) {
          const waitMs = Math.pow(2, attempt) * 1000
          logger.warn(`Server error (${response.status}). Retrying in ${waitMs}ms`)
          await new Promise(resolve => setTimeout(resolve, waitMs))
          return this.get<T>(url, attempt + 1)
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data as T
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      if (attempt < this.retries) {
        const waitMs = Math.pow(2, attempt) * 1000
        logger.warn(`Fetch failed: ${message}. Retrying in ${waitMs}ms`)
        await new Promise(resolve => setTimeout(resolve, waitMs))
        return this.get<T>(url, attempt + 1)
      }

      logger.error(`Failed to fetch ${url} after ${this.retries} attempts`, { error: message })
      return null
    }
  }

  async post<T>(url: string, body: Record<string, unknown>, attempt = 1): Promise<T | null> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429 && attempt < this.retries) {
          const retryAfter = response.headers.get('Retry-After')
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, waitMs))
          return this.post<T>(url, body, attempt + 1)
        }

        if (response.status >= 500 && attempt < this.retries) {
          const waitMs = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, waitMs))
          return this.post<T>(url, body, attempt + 1)
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data as T
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      if (attempt < this.retries) {
        const waitMs = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitMs))
        return this.post<T>(url, body, attempt + 1)
      }

      logger.error(`Failed to POST ${url} after ${this.retries} attempts`, { error: message })
      return null
    }
  }
}
