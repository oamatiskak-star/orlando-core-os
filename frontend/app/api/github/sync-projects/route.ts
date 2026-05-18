import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const GITHUB_USER  = 'oamatiskak-star'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`

  // Haal alle repos op (max 100 per pagina)
  let allRepos: Array<{
    id: number; name: string; full_name: string; html_url: string;
    description: string | null; language: string | null;
    private: boolean; archived: boolean;
    created_at: string; updated_at: string; pushed_at: string;
    topics: string[]
  }> = []

  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated&page=${page}`,
      { headers }
    )
    if (!res.ok) break
    const batch = await res.json() as typeof allRepos
    if (!batch.length) break
    allRepos = [...allRepos, ...batch]
    if (batch.length < 100) break
  }

  let synced = 0

  for (const repo of allRepos) {
    const { error } = await supabase.from('projects').upsert({
      name:        repo.name,
      type:        'development',
      status:      repo.archived ? 'afgerond' : 'actief',
      notes:       [
        repo.description ?? '',
        `GitHub: ${repo.html_url}`,
        repo.language ? `Taal: ${repo.language}` : '',
        repo.topics?.length ? `Topics: ${repo.topics.join(', ')}` : '',
      ].filter(Boolean).join('\n'),
      start_date:  repo.created_at?.split('T')[0] ?? null,
      location:    null,
      address:     null,
      budget:      null,
    }, {
      onConflict:      'name',
      ignoreDuplicates: false,
    })

    if (!error) synced++
  }

  return NextResponse.json({ ok: true, synced, total: allRepos.length })
}
