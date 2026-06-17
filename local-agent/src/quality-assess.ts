import 'dotenv/config'
import axios, { AxiosError } from 'axios'

/**
 * QC-ASSESS CLIENT (CF2 — stap 10).
 *
 * De engine heeft GEEN LLM-SDK; QC draait in de frontend Next.js-route
 * (/api/youtube/quality/assess op claude.sonnet). Deze thin client roept die canonieke route aan
 * en geeft het gate-resultaat terug. Geen FRONTEND_QC_URL → expliciete BLOCKED-reden (geen fake).
 *
 * RESILIENCE: transiente fouten (timeout / netwerk / 5xx / Vercel-coldstart / Claude-hapering)
 * worden NIET direct als blocked weggeschreven. We retryen met backoff (alleen op retryable fouten),
 * loggen de echte HTTP-status/body/fout-soort/duur, en geven pas ná alle pogingen definitief
 * blocked_qc_route_unreachable terug. 4xx = permanent (geen retry). Geen CQI/gate/threshold-
 * wijziging, geen fallback-naar-pass, geen verzonnen score.
 */

export interface QcResult {
  ok: boolean
  cqi?: number | null
  gate_passed?: boolean
  gate_reason?: string | null
  blocked?: string
  // diagnostiek
  qc_attempts?: number
  qc_last_status?: number | null
  qc_last_error?: string | null
  qc_duration_ms?: number
}

const MAX_ATTEMPTS = Math.max(1, parseInt(process.env.QC_MAX_ATTEMPTS ?? '3'))
const BACKOFF_MS = [0, 3000, 8000]   // wachttijd vóór poging 1, 2, 3 (eerste = geen wachten)
const TIMEOUT_MS = parseInt(process.env.QC_TIMEOUT_MS ?? '180000')  // QC draait claude.sonnet (kan >60s)

type FailKind = 'timeout' | 'network' | 'http_5xx' | 'http_4xx' | 'other'

function classify(e: AxiosError): { kind: FailKind; status: number | null; retryable: boolean } {
  if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message)) return { kind: 'timeout', status: null, retryable: true }
  const status = e.response?.status ?? null
  if (status === null) return { kind: 'network', status: null, retryable: true }      // geen respons → conn/DNS/reset
  if (status >= 500) return { kind: 'http_5xx', status, retryable: true }
  if (status >= 400) return { kind: 'http_4xx', status, retryable: false }            // permanent — niet retryen
  return { kind: 'other', status, retryable: false }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function assessQuality(videoProjectId: string): Promise<QcResult> {
  const base = process.env.FRONTEND_QC_URL
  if (!base) return { ok: false, blocked: 'blocked_missing_frontend_qc_url' }
  const url = `${base.replace(/\/$/, '')}/api/youtube/quality/assess`

  // Vercel Deployment Protection: de prod-frontend staat achter auth (401). Met een
  // 'Protection Bypass for Automation'-secret komt de engine er server-to-server door
  // zonder de dashboard publiek te maken. Geen secret → call gaat gewoon (werkt als
  // protection uit staat). Secret zet je in Vercel + als VERCEL_AUTOMATION_BYPASS_SECRET.
  // Alleen de bypass-header (server-to-server). GEEN set-bypass-cookie → die triggert een
  // 307-cookie-redirect die axios in een redirect-loop duwt ("Maximum redirects exceeded").
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const headers = bypass ? { 'x-vercel-protection-bypass': bypass } : undefined

  let lastStatus: number | null = null
  let lastError: string | null = null
  let lastDuration = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
    if (wait) await sleep(wait)

    const t0 = Date.now()
    try {
      const res = await axios.post(url, { video_project_id: videoProjectId }, { timeout: TIMEOUT_MS, headers })
      const dur = Date.now() - t0
      console.log(`[qc] assess OK project=${videoProjectId} attempt=${attempt}/${MAX_ATTEMPTS} status=${res.status} dur=${dur}ms`)
      return {
        ok: true,
        cqi: res.data?.cqi ?? null,
        gate_passed: !!res.data?.gate_passed,
        gate_reason: res.data?.gate_reason ?? null,
        qc_attempts: attempt, qc_last_status: res.status, qc_last_error: null, qc_duration_ms: dur,
      }
    } catch (e) {
      const dur = Date.now() - t0
      const err = e as AxiosError
      const c = classify(err)
      lastStatus = c.status
      lastDuration = dur
      lastError = `${c.kind}${c.status ? ' ' + c.status : ''}: ${err.message}`
      const body = err.response?.data
      const bodyStr = typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body ?? {}).slice(0, 200)
      console.warn(`[qc] assess FAIL project=${videoProjectId} attempt=${attempt}/${MAX_ATTEMPTS} kind=${c.kind} status=${c.status ?? '-'} retryable=${c.retryable} dur=${dur}ms err="${err.message}" body=${bodyStr}`)

      if (!c.retryable || attempt === MAX_ATTEMPTS) {
        return { ok: false, blocked: 'blocked_qc_route_unreachable', qc_attempts: attempt, qc_last_status: c.status, qc_last_error: lastError, qc_duration_ms: dur }
      }
      // retryable + nog pogingen over → volgende iteratie (backoff vooraan).
    }
  }

  // defensief (loop hoort altijd te returnen)
  return { ok: false, blocked: 'blocked_qc_route_unreachable', qc_attempts: MAX_ATTEMPTS, qc_last_status: lastStatus, qc_last_error: lastError, qc_duration_ms: lastDuration }
}
