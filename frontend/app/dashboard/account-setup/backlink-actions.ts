'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { BacklinkStatus, BacklinkCategory } from '@/lib/backlinks/types';

/**
 * Server actions voor de Backlink Factory (migratie 141). Schrijfacties via
 * admin-client (RLS: authenticated read-only, service_role full).
 */

const ALL_STATUS: BacklinkStatus[] = ['not_started', 'queued', 'submitted', 'pending', 'live', 'rejected', 'na'];
const ALL_CATEGORY: BacklinkCategory[] = ['owned', 'directory_saas', 'directory_ai', 'directory_nl', 'community', 'blog_outreach', 'pr', 'other'];
const PATH = '/dashboard/account-setup/backlinks';

// Status bijwerken (+ placement-URL wist status-implicatie niet).
export async function setBacklinkStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('submit_status') ?? '').trim() as BacklinkStatus;
  if (!id) throw new Error('id ontbreekt');
  if (!ALL_STATUS.includes(status)) throw new Error('Ongeldige status');

  const admin = createAdminClient();
  const { error } = await admin.from('backlink_targets').update({ submit_status: status }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// Verkregen backlink-URL opslaan; lege waarde wist 'm. Niet-leeg → status 'live'.
export async function saveBacklinkPlacement(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  const placement = String(formData.get('placement_url') ?? '').trim();
  if (!id) throw new Error('id ontbreekt');

  const patch: Record<string, unknown> = { placement_url: placement || null };
  if (placement) patch.submit_status = 'live';

  const admin = createAdminClient();
  const { error } = await admin.from('backlink_targets').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// Nieuw target toevoegen.
export async function createBacklinkTarget(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? 'other').trim() as BacklinkCategory;
  const url = String(formData.get('url') ?? '').trim();
  const tier = parseInt(String(formData.get('tier') ?? '2'), 10) || 2;
  if (!name) throw new Error('Naam is verplicht');
  if (!ALL_CATEGORY.includes(category)) throw new Error('Ongeldige categorie');

  const admin = createAdminClient();
  const { error } = await admin.from('backlink_targets').insert({
    site: 'aquier.com', name, category, url: url || null, tier,
  });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
