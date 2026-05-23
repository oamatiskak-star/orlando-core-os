import { chromium, webkit, Browser, BrowserContext, Page, devices as playwrightDevices } from 'playwright'
import type { DeviceSpec } from '../types'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'

let _chromium: Browser | null = null
let _webkit: Browser | null = null

export async function getBrowser(kind: 'chromium' | 'webkit'): Promise<Browser> {
  if (kind === 'chromium') {
    if (!_chromium) {
      _chromium = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
      logger.info('chromium launched')
    }
    return _chromium
  }
  if (env.SKIP_WEBKIT_DEVICES) {
    throw new Error('WebKit disabled (SKIP_WEBKIT_DEVICES=true). Add WebKit system libs via Docker to enable Safari testing.')
  }
  if (!_webkit) {
    _webkit = await webkit.launch({ headless: true })
    logger.info('webkit launched')
  }
  return _webkit
}

export async function closeBrowsers(): Promise<void> {
  await Promise.allSettled([_chromium?.close(), _webkit?.close()])
  _chromium = null
  _webkit = null
}

export async function newContextForDevice(device: DeviceSpec): Promise<BrowserContext> {
  const browser = await getBrowser(device.playwright_browser)
  const context = await browser.newContext({
    viewport: device.viewport,
    userAgent: device.user_agent,
    isMobile: device.is_mobile,
    hasTouch: device.has_touch,
    locale: 'en-US', // overridden per scenario via setExtraHTTPHeaders
    recordVideo: undefined, // enabled per-scenario
  })
  return context
}

export type PageWithDevice = { page: Page; context: BrowserContext; device: DeviceSpec }
