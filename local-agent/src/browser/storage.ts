/**
 * Storage helper voor de browser-registration runner: upload per-stap
 * screenshots naar de private bucket 'account-setup-artifacts' (migratie 103).
 * Patroon overgenomen van checkout-auditor/src/lib/storage.ts, maar
 * zelfstandig (geen aquier-env afhankelijkheid) en op de eigen bucket.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const ARTIFACTS_BUCKET = 'account-setup-artifacts'

export function buildScreenshotPath(runId: string, programId: string, orderIdx: number): string {
  const datePart = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const ts = Date.now()
  return `${datePart}/${runId}/${programId}/step-${String(orderIdx).padStart(3, '0')}-${ts}.png`
}

export async function uploadScreenshot(db: SupabaseClient, path: string, body: Buffer): Promise<string> {
  const { error } = await db.storage.from(ARTIFACTS_BUCKET).upload(path, body, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) throw new Error(`Screenshot-upload faalde (${path}): ${error.message}`)
  return path
}
