/**
 * Cat 4 — Aquier Lead Generation
 * - B2B AI Lead Extractor (bestaand)
 * - Y Combinator founders (bestaand)
 * - Google Maps business emails (nieuw — lokale bedrijven met email)
 * - Apollo/ZoomInfo scraper (nieuw — verified B2B emails op schaal)
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

async function fetchGoogleMapsLeads(log) {
  const queries = ['SaaS startup Netherlands', 'tech founder Amsterdam', 'AI company Netherlands']
  const leads = []
  for (const query of queries) {
    try {
      const { items, runId } = await runAndCollect(
        ACTORS.GMAPS_LEADS,
        { searchQuery: query, maxResults: 50 },
        { timeoutMs: 180_000 },
      )
      log(`Google Maps "${query}" → ${items.length} bedrijven`)
      for (const item of items) {
        if (!item.email && !item.website) continue
        leads.push({
          source: 'google_maps',
          actor_run_id: runId,
          company: item.name || item.title || null,
          name: null,
          email: item.email || null,
          linkedin_url: null,
          website: item.website || null,
          description: item.category || item.description || null,
          raw: item,
        })
      }
    } catch (err) {
      log(`⚠️  Google Maps "${query}": ${err.message}`)
    }
  }
  return leads
}

async function fetchApolloLeads(log) {
  const queries = AQUIER_LEAD_QUERIES.slice(0, 2) // max 2 queries voor kostenbeheer
  const leads = []
  for (const query of queries) {
    try {
      const { items, runId } = await runAndCollect(
        ACTORS.APOLLO_LEADS,
        { searchQuery: query, maxResults: 50, includeEmail: true },
        { timeoutMs: 300_000 },
      )
      log(`Apollo leads "${query}" → ${items.length}`)
      for (const item of items) {
        leads.push({
          source: 'apollo',
          actor_run_id: runId,
          company: item.company || item.organization?.name || null,
          name: item.name || item.firstName ? `${item.firstName || ''} ${item.lastName || ''}`.trim() : null,
          email: item.email || null,
          linkedin_url: item.linkedinUrl || item.linkedin_url || null,
          website: item.website || item.organization?.website_url || null,
          description: item.title || item.headline || null,
          raw: item,
        })
      }
    } catch (err) {
      log(`⚠️  Apollo leads "${query}": ${err.message}`)
    }
  }
  return leads
}

export async function run(log = console.log) {
  log('[aquier-leads] start')
  const started = Date.now()

  const [b2bLeads, ycLeads, gmapsLeads, apolloLeads] = await Promise.all([
    fetchB2BLeads(log),
    fetchYCombinatorLeads(log),
    fetchGoogleMapsLeads(log),
    fetchApolloLeads(log),
  ])

  const allLeads = [...b2bLeads, ...ycLeads, ...gmapsLeads, ...apolloLeads]
  let saved = 0, skipped = 0

  for (const lead of allLeads) {
    if (lead.email) {
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
  await heartbeat(ENGINE_KEY, { saved, skipped, b2b: b2bLeads.length, yc: ycLeads.length, gmaps: gmapsLeads.length, apollo: apolloLeads.length, ms })
  log(`[aquier-leads] klaar in ${ms}ms — ${saved} opgeslagen, ${skipped} duplicaten (B2B:${b2bLeads.length} YC:${ycLeads.length} Maps:${gmapsLeads.length} Apollo:${apolloLeads.length})`)
  return { saved, skipped }
}
