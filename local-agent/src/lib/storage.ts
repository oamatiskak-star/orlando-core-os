import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const BUCKET = 'yt-videos'

export async function uploadVideoToStorage(
  localPath: string,
  storagePath: string,
): Promise<string> {
  const buffer = fs.readFileSync(localPath)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType:  'video/mp4',
      upsert:       true,
      cacheControl: '3600',
    })

  if (error) throw new Error(`Storage upload mislukt: ${error.message}`)

  // Signed URL geldig 7 dagen (voor engine om te downloaden)
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 7 * 24 * 3600)

  if (!signed?.signedUrl) throw new Error('Kon geen signed URL aanmaken')

  return signed.signedUrl
}

export async function deleteFromStorage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (error) console.warn(`Storage delete mislukt (${storagePath}):`, error.message)
}
