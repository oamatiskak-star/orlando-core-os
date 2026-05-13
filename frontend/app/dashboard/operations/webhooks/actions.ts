'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createWebhook(fd: FormData) {
  const supabase = await createClient()

  const endpointPath = (fd.get('endpoint_path') as string)
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_/]/g, '-')

  await supabase.from('oc_webhooks').insert({
    naam: fd.get('naam') as string,
    company: (fd.get('company') as string) || 'MODIWÉ',
    endpoint_path: endpointPath,
    secret: crypto.randomUUID().replace(/-/g, ''),
    workflow_id: (fd.get('workflow_id') as string) || null,
    method: (fd.get('method') as string) || 'POST',
    status: 'actief',
    trigger_count: 0,
  })

  revalidatePath('/dashboard/operations/webhooks')
}

export async function toggleWebhook(id: string, current: string) {
  const supabase = await createClient()
  const newStatus = current === 'actief' ? 'inactief' : 'actief'
  await supabase.from('oc_webhooks').update({ status: newStatus }).eq('id', id)
  revalidatePath('/dashboard/operations/webhooks')
}

export async function regenerateSecret(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_webhooks').update({ secret: crypto.randomUUID().replace(/-/g, '') }).eq('id', id)
  revalidatePath('/dashboard/operations/webhooks')
}

export async function deleteWebhook(id: string) {
  const supabase = await createClient()
  await supabase.from('oc_webhooks').delete().eq('id', id)
  revalidatePath('/dashboard/operations/webhooks')
}
