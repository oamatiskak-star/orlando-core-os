import 'dotenv/config'
import axios from 'axios'

/**
 * QC-ASSESS CLIENT (CF2 — stap 10).
 *
 * De engine heeft GEEN LLM-SDK; QC draait in de frontend Next.js-route
 * (/api/youtube/quality/assess op claude.sonnet). Deze thin client roept die
 * canonieke route aan en geeft het gate-resultaat terug. Geen FRONTEND_QC_URL →
 * expliciete BLOCKED-reden (geen fake score).
 */

export interface QcResult {
  ok: boolean
  cqi?: number | null
  gate_passed?: boolean
  gate_reason?: string | null
  blocked?: string
}

export async function assessQuality(videoProjectId: string): Promise<QcResult> {
  const base = process.env.FRONTEND_QC_URL
  if (!base) return { ok: false, blocked: 'blocked_missing_frontend_qc_url' }
  try {
    const res = await axios.post(
      `${base.replace(/\/$/, '')}/api/youtube/quality/assess`,
      { video_project_id: videoProjectId },
      { timeout: 60_000 },
    )
    return {
      ok: true,
      cqi: res.data?.cqi ?? null,
      gate_passed: !!res.data?.gate_passed,
      gate_reason: res.data?.gate_reason ?? null,
    }
  } catch (e: any) {
    return { ok: false, blocked: 'blocked_qc_route_unreachable' }
  }
}
