'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createApiConnection(fd: FormData) {
  const supabase = await createClient()

  const credentials: Record<string, string> = {}
  const credentialsRaw = fd.get('credentials') as string
  if (credentialsRaw) {
    try { Object.assign(credentials, JSON.parse(credentialsRaw)) } catch { credentials.raw = credentialsRaw }
  }

  await supabase.from('oc_api_connections').insert({
    naam: fd.get('naam') as string,
    company: (fd.get('company') as string) || 'MODIWÉ',
    service: fd.get('service') as string,
    base_url: (fd.get('base_url') as string) || null,
    auth_type: fd.get('auth_type') as string,
    credentials,
    status: 'actief',
  })

  revalidatePath('/dashboard/operations/api-connections')
}

export async function testApiConnection(id: string) {
  const supabase = await createClient()
  const { data: conn } = await supabase.from('oc_api_connections').select('base_url').eq('id', id).single()

  if (!conn?.base_url) {
    await supabase.from('oc_api_connections').update({
      last_tested_at: new Date().toISOString(),
      last_error: 'No base URL configured',
      status: 'error',
    }).eq('id', id)
    revalidatePath('/dashboard/operations/api-connections')
    return
  }

  try {
    const res = await fetch(conn.base_url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    await supabase.from('oc_api_connections').update({
      last_tested_at: new Date().toISOString(),
      last_error: null,
      status: res.ok ? 'actief' : 'error',
    }).eq('id', id)
  } catch (err) {
    await supabase.from('oc_api_connections').update({
      last_tested_at: new Date().toISOString(),
      last_error: err instanceof Error ? err.message : 'Connection failed',
      status: 'error',
    }).eq('id', id)
  }

  revalidatePath('/dashboard/operations/api-connections')
}

export async function deleteApiConnection(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_api_connections').delete().eq('id', id)
  revalidatePath('/dashboard/operations/api-connections')
}
