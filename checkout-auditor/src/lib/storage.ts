import { supabase } from './supabase'
import { env } from './secrets'
import { logger } from './logger'

/**
 * Upload artifact (screenshot/video/HAR/etc.) to Supabase Storage and return storage path.
 * Bucket must already exist + be private (RLS service_role only).
 */
export async function uploadArtifact(
  storagePath: string,
  body: Buffer | string,
  contentType: string,
): Promise<{ path: string; size_bytes: number; mime_type: string }> {
  const bucket = env.SUPABASE_STORAGE_BUCKET
  const bodyBuffer = typeof body === 'string' ? Buffer.from(body) : body

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bodyBuffer, {
    contentType,
    upsert: true,
  })
  if (error) {
    logger.error({ err: error.message, storagePath }, 'storage upload failed')
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  return { path: storagePath, size_bytes: bodyBuffer.byteLength, mime_type: contentType }
}

export async function deleteArtifact(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storagePath])
  if (error) {
    logger.warn({ err: error.message, storagePath }, 'storage delete failed')
  }
}

export function buildArtifactPath(runId: string, scenarioId: string | null, kind: string, ext: string): string {
  const datePart = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const ts = Date.now()
  const id = scenarioId ?? 'run'
  return `${datePart}/${runId}/${id}/${kind}-${ts}.${ext}`
}
