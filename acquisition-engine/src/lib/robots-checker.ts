import { logger } from './logger'
import { HttpClient } from './http-client'

export class RobotsChecker {
  private cache: Map<string, { canScrape: boolean; crawlDelay: number }> = new Map()
  private httpClient: HttpClient
  private botName = 'Orlando-AcquisitionBot'

  constructor() {
    this.httpClient = new HttpClient({ timeout: 5000, retries: 1 })
  }

  async canScrape(domain: string): Promise<{ allowed: boolean; crawlDelay: number }> {
    const cached = this.cache.get(domain)
    if (cached) {
      return { allowed: cached.canScrape, crawlDelay: cached.crawlDelay }
    }

    try {
      const robotsUrl = `https://${domain}/robots.txt`
      const response = await this.httpClient.get<string>(robotsUrl)

      if (!response) {
        logger.warn(`Could not fetch robots.txt for ${domain}. Assuming allowed with 2s delay.`)
        this.cache.set(domain, { canScrape: true, crawlDelay: 2000 })
        return { allowed: true, crawlDelay: 2000 }
      }

      const robotsTxt = typeof response === 'string' ? response : String(response)
      const result = this.parseRobots(robotsTxt, domain)

      this.cache.set(domain, { canScrape: result.allowed, crawlDelay: result.crawlDelay })
      return { allowed: result.allowed, crawlDelay: result.crawlDelay }
    } catch (err) {
      logger.error(`Error checking robots.txt for ${domain}`, { error: String(err) })
      // Conservative: assume allowed with longer delay
      this.cache.set(domain, { canScrape: true, crawlDelay: 5000 })
      return { allowed: true, crawlDelay: 5000 }
    }
  }

  private parseRobots(
    content: string,
    domain: string
  ): { allowed: boolean; crawlDelay: number } {
    const lines = content.split('\n')
    let currentBotBlock: string[] = []
    let isOurBot = false
    let crawlDelay = 2000 // default 2 seconds

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()

      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.split(':', 1)[1]?.trim() || ''
        isOurBot = agent === '*' || agent.includes(this.botName.toLowerCase())
        currentBotBlock = isOurBot ? [trimmed] : []
        continue
      }

      if (isOurBot) {
        currentBotBlock.push(trimmed)

        if (trimmed.startsWith('disallow:')) {
          const path = trimmed.split(':', 1)[1]?.trim() || ''
          if (path === '/' || path === '') {
            logger.warn(`${domain} disallows all scraping in robots.txt`)
            return { allowed: false, crawlDelay }
          }
        }

        if (trimmed.startsWith('crawl-delay:')) {
          const delayStr = trimmed.split(':', 1)[1]?.trim() || ''
          const parsed = parseFloat(delayStr)
          if (!isNaN(parsed)) {
            crawlDelay = Math.max(1000, Math.floor(parsed * 1000)) // min 1s
          }
        }
      }
    }

    return { allowed: true, crawlDelay }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
