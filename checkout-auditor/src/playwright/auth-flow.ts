import type { Page, BrowserContext } from 'playwright'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'

export type AuthFlowResult = {
  attempted: boolean
  success: boolean
  pre_login_url: string | null
  post_login_url: string | null
  duration_ms: number
  steps: string[]
  errors: string[]
  // Diagnostic data captured around the submit moment
  login_xhr_responses: Array<{ url: string; status: number; body_excerpt: string }>
  page_text_after_submit: string | null
  cookies_after_submit: string[]
}

const LOGIN_FORM_SELECTORS = {
  email: [
    'input[type="email"]',
    'input[name="email"]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
    'input[id="email"]',
    'input[placeholder*="mail" i]',
    'input[placeholder*="e-mail" i]',
  ],
  password: [
    'input[type="password"]',
    'input[name="password"]',
    'input[autocomplete="current-password"]',
    'input[id="password"]',
    'input[placeholder*="wachtwoord" i]',
    'input[placeholder*="password" i]',
  ],
  submit: [
    'button[type="submit"]:has-text("Inloggen")',
    'button[type="submit"]:has-text("Login")',
    'button[type="submit"]:has-text("Sign in")',
    'button:has-text("Inloggen")',
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    'button[type="submit"]',
  ],
}

const LOGIN_SUCCESS_PATTERNS = [
  /\/dashboard/,
  /\/account/,
  /\/profile/,
  /\/marketplace/,
  /\/membership/,  // post-login redirect back to membership via ?next=
]

/**
 * Attempts to log in to aquier.com using TEST_USER_EMAIL + TEST_USER_PASSWORD env vars.
 * No-op (skip) if credentials are not configured.
 *
 * The page should be left in an authenticated state — subsequent walkthrough
 * navigations to /membership will then proceed to Stripe Checkout instead of redirecting to /login.
 *
 * Strategy:
 *   1. navigate to /login
 *   2. wait for SPA hydration (input[type=email] or input[type=password] appears)
 *   3. fill email + password
 *   4. submit form
 *   5. wait for URL change away from /login (or success page pattern)
 */
export async function loginIfConfigured(page: Page, context: BrowserContext): Promise<AuthFlowResult> {
  const result: AuthFlowResult = {
    attempted: false,
    success: false,
    pre_login_url: null,
    post_login_url: null,
    duration_ms: 0,
    steps: [],
    errors: [],
    login_xhr_responses: [],
    page_text_after_submit: null,
    cookies_after_submit: [],
  }
  const start = Date.now()

  if (!env.TEST_USER_EMAIL || !env.TEST_USER_PASSWORD) {
    result.steps.push('skipped (TEST_USER_EMAIL/PASSWORD not configured — anonymous flow)')
    return result
  }
  result.attempted = true

  try {
    const loginUrl = new URL('/login', env.AQUIER_BASE_URL).toString()
    result.pre_login_url = page.url() || loginUrl

    // 1. Navigate to /login
    result.steps.push('navigate /login')
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // 2. Wait for SPA hydration: an email/password input must appear
    result.steps.push('wait for SPA hydration')
    const hydrated = await Promise.race([
      page.waitForSelector(LOGIN_FORM_SELECTORS.email.join(','), { timeout: 15_000 }).then(() => true).catch(() => false),
      page.waitForSelector(LOGIN_FORM_SELECTORS.password.join(','), { timeout: 15_000 }).then(() => true).catch(() => false),
    ])
    if (!hydrated) {
      result.errors.push('login form did not hydrate within 15s')
      return finalize(result, start)
    }

    // 3. Fill email
    const emailSel = await firstAvailable(page, LOGIN_FORM_SELECTORS.email)
    if (!emailSel) {
      result.errors.push('email input not found')
      return finalize(result, start)
    }
    await page.locator(emailSel).first().fill(env.TEST_USER_EMAIL)
    result.steps.push(`email filled via ${emailSel}`)

    // 4. Fill password
    const passwordSel = await firstAvailable(page, LOGIN_FORM_SELECTORS.password)
    if (!passwordSel) {
      result.errors.push('password input not found')
      return finalize(result, start)
    }
    await page.locator(passwordSel).first().fill(env.TEST_USER_PASSWORD)
    result.steps.push(`password filled via ${passwordSel}`)

    // 5. Attach XHR response capture for login API calls
    const xhrHandler = async (response: import('playwright').Response) => {
      const url = response.url()
      if (/\/(login|signin|auth|session)/i.test(url) && /api/i.test(url)) {
        try {
          const body = await response.text().catch(() => '')
          result.login_xhr_responses.push({
            url,
            status: response.status(),
            body_excerpt: body.slice(0, 500),
          })
        } catch { /* ignore */ }
      }
    }
    page.on('response', xhrHandler)

    // 6. Submit
    const submitSel = await firstAvailable(page, LOGIN_FORM_SELECTORS.submit)
    if (!submitSel) {
      result.errors.push('submit button not found')
      return finalize(result, start)
    }
    const submitClick = page.locator(submitSel).first().click()

    // 6. Wait for navigation away from /login (success) OR error visible on page
    result.steps.push('submit + wait for nav')
    await Promise.race([
      page.waitForURL(url => {
        const s = url.toString()
        return !s.includes('/login') && LOGIN_SUCCESS_PATTERNS.some(p => p.test(s))
      }, { timeout: 20_000 }).catch(() => null),
      submitClick.catch(() => null),
      page.waitForTimeout(20_000),
    ])

    // Allow 3s extra for XHR responses + error rendering
    await page.waitForTimeout(3000)

    result.post_login_url = page.url()
    const stillOnLogin = /\/login/.test(result.post_login_url)
    result.success = !stillOnLogin

    // Always capture diagnostic data after submit
    try {
      const fullBodyText = (await page.locator('body').textContent().catch(() => '')) ?? ''
      // Find lines containing common error keywords (≤200 chars each)
      const errorLines = fullBodyText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && l.length < 250 && /error|fout|invalid|incorrect|verkeerd|ongeldig|fail|denied|onjuist|toegang/i.test(l))
        .slice(0, 5)
      result.page_text_after_submit = errorLines.length > 0
        ? errorLines.join(' | ')
        : fullBodyText.slice(0, 500)
    } catch { /* ignore */ }

    try {
      const ck = await context.cookies()
      result.cookies_after_submit = ck
        .filter(c => /aquier|session|auth|token|sb-|sb_/i.test(c.name))
        .map(c => `${c.name}=${c.value.slice(0, 20)}…`)
    } catch { /* ignore */ }

    if (stillOnLogin) {
      // Look for error message in DOM (broader selectors)
      const errorText = await page.locator(
        '[role="alert"], .error, .text-red-500, .text-red-400, .text-red-600, ' +
        '[class*="error"], [class*="Error"], [data-testid*="error"], ' +
        '[aria-live="assertive"], [aria-live="polite"]',
      ).first().textContent().catch(() => null)
      if (errorText) result.errors.push(`login DOM error: ${errorText.slice(0, 300)}`)
      else result.errors.push(`stayed on /login after submit — check login_xhr_responses + page_text_after_submit for clues`)

      if (result.login_xhr_responses.length === 0) {
        result.errors.push('no /login or /auth XHR response captured — form may use non-API submit or different endpoint pattern')
      }
    } else {
      result.steps.push(`landed on ${result.post_login_url}`)
    }

    page.off('response', xhrHandler)
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err))
    logger.warn({ err: String(err) }, 'auth flow failed')
  }

  return finalize(result, start)
}

function finalize(result: AuthFlowResult, start: number): AuthFlowResult {
  result.duration_ms = Date.now() - start
  return result
}

async function firstAvailable(page: Page, candidates: string[]): Promise<string | null> {
  for (const sel of candidates) {
    try {
      const count = await page.locator(sel).count()
      if (count > 0) return sel
    } catch { /* try next */ }
  }
  return null
}
