/**
 * Cat 4 — Aquier Lead Generation
 * Scraapt B2B leads + Y Combinator founders voor Aquier.com pipeline.
 * Slaat op in aquier_apify_leads, overslaat al bekende emails.
 */
import { runAndCollect } from '../lib/apify.mjs'
import { db, heartbeat } from '../lib/supabase.mjs'
import { ACTORS, AQUIER_LEAD_QUERIES } from '../config.mjs'

const ENGINE_KEY = 'apify:aquier-leads'

async function fetchB2BLeads(log) {
  const leads = []
  for (const query of AQUIER_LEAD_QUERIES) {
    try {
      const { items, runId } = await runAndCollect(
        ACTORS.B2B_LEADS,
        {
          searchQuery: query,
          maxResults: 50,
          includeEmail: true,
          includeLinkedIn: true,
        },
        { timeoutMs: 180_000 },
      )
      log(`B2B Leads "${query}" → ${items.length}`)
      for (const item of items) {
        leads.push({
          source: 'b2b_leads',
          actor_run_id: runId,
          company: item.company || item.organization || null,
          name: item.name || item.fullName || null,
          email: item.email || null,
          linkedin_url: item.linkedin || item.linkedinUrl || null,
          website: item.website || item.domain || null,
          description: item.description || item.title || null,
          raw: item,
        })
      }
    } catch (err) {
      log(`⚠️  B2B leads "${query}": ${err.message}`)
    }
  }
  return leads
}

async function fetchYCombinatorLeads(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.YC_SCRAPER,
      { batch: 'W25,S25', status: 'Active', maxItems: 100 },
      { timeoutMs: 180_000 },
    )
    log(`YCombinator → ${items.length} startups`)
    return items.map(item => ({
      source: 'ycombinator',
      actor_run_id: runId,
      company: item.name || item.company || null,
      name: item.founderName || null,
      email: item.email || null,
      linkedin_url: item.linkedinUrl || null,
      website: item.website || item.url || null,
      description: item.description || item.oneLiner || null,
      raw: item,
    }))
  } catch (err) {
    log(`⚠️  YCombinator: ${err.message}`)
    return []
  }
}

export async function run(log = console.log) {
  log('[aquier-leads] start')
  const started = Date.now()

  const [b2bLeads, ycLeads] = await Promise.all([
    fetchB2BLeads(log),
    fetchYCombinatorLeads(log),
  ])

  const allLeads = [...b2bLeads, ...ycLeads]
  let saved = 0, skipped = 0

  for (const lead of allLeads) {
    if (lead.email) {
      // Dedup op email
      const { data: existing } = await db()
        .from('aquier_apify_leads')
        .select('id')
        .eq('email', lead.email)
        .maybeSingle()
      if (existing) { skipped++; continue }
    }
    const { error } = await db().from('aquier_apify_leads').insert(lead)
    if (error) log(`⚠️  Insert lead: ${error.message}`)
    else saved++
  }

  const ms = Date.now() - started
  await heartbeat(ENGINE_KEY, { saved, skipped, ms })
  log(`[aquier-leads] klaar in ${ms}ms — ${saved} opgeslagen, ${skipped} duplicaten`)
  return { saved, skipped }
}
