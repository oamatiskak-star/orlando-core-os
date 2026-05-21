import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const GITHUB_USER  = 'oamatiskak-star'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const MAX_NOTES_LENGTH = 4000 // Prevent storage quota issues
const RATE_LIMIT_WAIT = 500 // ms between requests

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`

  let allRepos: Array<{
    id: number; name: string; full_name: string; html_url: string;
    description: string | null; language: string | null;
    private: boolean; archived: boolean;
    created_at: string; updated_at: string; pushed_at: string;
    topics: string[]
  }> = []

  const errors: string[] = []

  // Fetch all repos with rate limiting
  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(
        `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated&page=${page}`,
        { headers }
      )

      if (res.status === 403) {
        const remaining = res.headers.get('x-ratelimit-remaining')
        const reset = res.headers.get('x-ratelimit-reset')
        errors.push(`GitHub API rate limit exceeded. Reset at: ${reset}`)
        break
      }

      if (!res.ok) {
        errors.push(`GitHub API page ${page} failed: ${res.status}`)
        break
      }

      const batch = await res.json() as typeof allRepos
      if (!Array.isArray(batch) || batch.length === 0) break

      allRepos = [...allRepos, ...batch]
      if (batch.length < 100) break

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT))
    } catch (err) {
      errors.push(`Network error on page ${page}: ${err instanceof Error ? err.message : String(err)}`)
      break
    }
  }

  let synced = 0
  const failedRepos: string[] = []

  // Store repos with validation and size limits
  for (const repo of allRepos) {
    try {
      let notes = [
        repo.description ?? '',
        `GitHub: ${repo.html_url}`,
        repo.language ? `Taal: ${repo.language}` : '',
        repo.topics?.length ? `Topics: ${repo.topics.join(', ')}` : '',
      ].filter(Boolean).join('\n')

      // Truncate notes if too large
      if (notes.length > MAX_NOTES_LENGTH) {
        notes = notes.substring(0, MAX_NOTES_LENGTH - 3) + '...'
      }

      const { error } = await supabase.from('projects').upsert({
        name:        repo.name,
        type:        'development',
        status:      repo.archived ? 'afgerond' : 'actief',
        notes:       notes,
        start_date:  repo.created_at?.split('T')[0] ?? null,
        location:    null,
        address:     null,
        budget:      null,
      }, {
        onConflict:      'name',
        ignoreDuplicates: false,
      })

      if (error) {
        failedRepos.push(`${repo.name}: ${error.message}`)
      } else {
        synced++
      }
    } catch (err) {
      failedRepos.push(`${repo.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0 && failedRepos.length === 0,
    synced,
    total: allRepos.length,
    errors: errors.length > 0 ? errors : undefined,
    failedRepos: failedRepos.length > 0 ? failedRepos : undefined,
  })
}
