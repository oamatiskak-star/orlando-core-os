'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function calcClass(roi: number | null): string {
  if (!roi) return 'C'
  if (roi >= 20) return 'A'
  if (roi >= 12) return 'B'
  return 'C'
}

export async function createDeal(formData: FormData) {
  const supabase = await createClient()
  const roi = formData.get('roi_pct') ? Number(formData.get('roi_pct')) : null

  await supabase.from('deals').insert({
    title:            (formData.get('title') as string) || null,
    address:          (formData.get('adres') as string) || null,
    city:             (formData.get('stad') as string) || null,
    asking_price:     formData.get('vraagprijs') ? Number(formData.get('vraagprijs')) : null,
    sqm:              formData.get('m2_wonen') ? Number(formData.get('m2_wonen')) : null,
    potential_profit: formData.get('potentieel_winst') ? Number(formData.get('potentieel_winst')) : null,
    roi_percentage:   roi,
    source:           (formData.get('bron') as string) || 'handmatig',
    funda_url:        (formData.get('funda_url') as string) || null,
    notes:            (formData.get('notities') as string) || null,
    class:            calcClass(roi),
    pipeline_fase:    'analyse',
    status:           'new',
  })

  revalidatePath('/dashboard/vastgoed')
}

export async function updateDealFase(id: string, fase: string) {
  const supabase = await createClient()
  await supabase.from('deals').update({ pipeline_fase: fase }).eq('id', id)
  revalidatePath('/dashboard/vastgoed')
}

export async function promoteDeal(id: string) {
  const supabase = await createClient()
  await supabase.from('deals').update({ pipeline_fase: 'analyse', status: 'review' }).eq('id', id)
  revalidatePath('/dashboard/vastgoed')
}

export async function deleteDeal(id: string) {
  const supabase = await createClient()
  await supabase.from('deals').delete().eq('id', id)
  revalidatePath('/dashboard/vastgoed')
}

export async function updateDealScore(id: string, score: string) {
  const supabase = await createClient()
  await supabase.from('deals').update({ class: score }).eq('id', id)
  revalidatePath('/dashboard/vastgoed')
}
