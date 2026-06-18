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

async function fetchLinkedInLeads(log) {
  const queries = AQUIER_LEAD_QUERIES.slice(0, 2)
  const leads = []
  for (const query of queries) {
    try {
      const { items: posts, runId: postsRun } = await runAndCollect(
        ACTORS.LI_POSTS,
        { keyword: query, maxResults: 30 },
        { timeoutMs: 120_000 },
      )
      log(`LinkedIn Posts "${query}" → ${posts.length} posts`)
      for (const post of posts) {
        const name = post.authorName || post.author?.name || null
        if (!name && !post.authorUrl) continue
        leads.push({
          source: 'linkedin_posts',
          actor_run_id: postsRun,
          company: null,
          name,
          email: null,
          linkedin_url: post.authorUrl || post.author?.url || null,
          website: null,
          description: post.text?.slice(0, 300) || post.content?.slice(0, 300) || null,
          raw: post,
        })
      }
    } catch (err) {
      log(`⚠️  LinkedIn Posts "${query}": ${err.message}`)
    }
  }

  try {
    const { items: profiles, runId: profilesRun } = await runAndCollect(
      ACTORS.LI_PROFILES,
      { searchUrl: 'https://www.linkedin.com/search/results/people/?keywords=founder+AI+startup', maxProfiles: 50 },
      { timeoutMs: 180_000 },
    )
    log(`LinkedIn Profiles → ${profiles.length} profielen`)
    for (const p of profiles) {
      leads.push({
        source: 'linkedin_profiles',
        actor_run_id: profilesRun,
        company: p.currentCompany || p.company || null,
        name: p.name || p.fullName || null,
        email: p.email || null,
        linkedin_url: p.profileUrl || p.url || null,
        website: null,
        description: p.headline || p.title || null,
        raw: p,
      })
    }
  } catch (err) {
    log(`⚠️  LinkedIn Profiles: ${err.message}`)
  }
  return leads
}

async function fetchJobSignals(log) {
  const leads = []
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.JOBS_SCRAPER,
      { query: 'AI engineer SaaS startup', location: 'Netherlands', maxItems: 50, platform: 'linkedin' },
      { timeoutMs: 180_000 },
    )
    log(`Job Signals → ${items.length} vacatures`)
    for (const job of items) {
      if (!job.company && !job.companyName) continue
      leads.push({
        source: 'job_signals',
        actor_run_id: runId,
        company: job.companyName || job.company || null,
        name: null,
        email: null,
        linkedin_url: job.companyLinkedinUrl || job.companyUrl || null,
        website: job.companyWebsite || null,
        description: `Hiring: ${job.title || job.jobTitle || ''} — ${job.location || ''}`,
        raw: job,
      })
    }
  } catch (err) {
    log(`⚠️  Job Signals: ${err.message}`)
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

async function fetchCrunchbaseLeads(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.CRUNCHBASE,
      { category: 'artificial-intelligence', maxItems: 50, fundingStage: 'seed,series_a' },
      { timeoutMs: 300_000 },
    )
    log(`Crunchbase → ${items.length} bedrijven`)
    return items.map(item => ({
      source: 'crunchbase',
      actor_run_id: runId,
      company: item.name || item.companyName || null,
      name: item.founderName || item.ceoName || null,
      email: item.email || null,
      linkedin_url: item.linkedinUrl || null,
      website: item.website || item.homepageUrl || null,
      description: item.shortDescription || item.description || null,
      raw: item,
    }))
  } catch (err) {
    log(`⚠️  Crunchbase: ${err.message}`)
    return []
  }
}

async function fetchCareerATS(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.CAREER_ATS,
      { query: 'AI startup engineer', location: 'Netherlands', maxResults: 50 },
      { timeoutMs: 180_000 },
    )
    log(`Career ATS → ${items.length} vacatures`)
    return items
      .filter(job => job.company || job.companyName)
      .map(job => ({
        source: 'career_ats',
        actor_run_id: runId,
        company: job.companyName || job.company || null,
        name: null,
        email: job.email || null,
        linkedin_url: job.companyLinkedinUrl || null,
        website: job.companyWebsite || job.applyUrl || null,
        description: `Hiring: ${job.title || job.jobTitle || ''} — ${job.location || ''}`,
        raw: job,
      }))
  } catch (err) {
    log(`⚠️  Career ATS: ${err.message}`)
    return []
  }
}

async function fetchWellfoundLeads(log) {
  try {
    const { items, runId } = await runAndCollect(
      ACTORS.WELLFOUND,
      { role: 'engineer', location: 'remote', maxJobs: 50 },
      { timeoutMs: 180_000 },
    )
    log(`Wellfound → ${items.length} startups`)
    return items.map(item => ({
      source: 'wellfound',
      actor_run_id: runId,
      company: item.company?.name || item.companyName || null,
      name: item.founderName || null,
      email: item.email || null,
      linkedin_url: item.company?.linkedinUrl || null,
      website: item.company?.website || item.companyUrl || null,
      description: item.company?.tagline || item.description || null,
      raw: item,
    }))
  } catch (err) {
    log(`⚠️  Wellfound: ${err.message}`)
    return []
  }
}

async function fetchCompanyIntelLeads(log) {
  const queries = AQUIER_LEAD_QUERIES.slice(0, 2)
  const leads = []
  for (const query of queries) {
    try {
      const { items, runId } = await runAndCollect(
        ACTORS.COMPANY_INTEL,
        { query, maxResults: 30 },
        { timeoutMs: 180_000 },
      )
      log(`Company Intel "${query}" → ${items.length}`)
      for (const item of items) {
        leads.push({
          source: 'company_intel',
          actor_run_id: runId,
          company: item.name || item.company || null,
          name: item.ceoName || item.founderName || null,
          email: item.email || null,
          linkedin_url: item.linkedinUrl || null,
          website: item.website || null,
          description: item.description || item.industry || null,
          raw: item,
        })
      }
    } catch (err) {
      log(`⚠️  Company Intel "${query}": ${err.message}`)
    }
  }
  return leads
}

async function fetchLinkedInEnrichment(log) {
  const { data: recentLeads } = await db()
    .from('aquier_apify_leads')
    .select('id, linkedin_url')
    .not('linkedin_url', 'is', null)
    .is('email', null)
    .limit(20)
  if (!recentLeads?.length) return []

  const leads = []
  const urls = recentLeads.map(l => l.linkedin_url).filter(Boolean).slice(0, 10)
  if (!urls.length) return []

  try {
    const { items, runId } = await runAndCollect(
      ACTORS.LI_ENRICHMENT,
      { profileUrls: urls },
      { timeoutMs: 180_000 },
    )
    log(`LinkedIn Enrichment → ${items.length} verrijkte profielen`)
    for (const item of items) {
      if (!item.email) continue
      const matchedLead = recentLeads.find(l => l.linkedin_url === item.profileUrl || l.linkedin_url === item.url)
      if (matchedLead) {
        await db().from('aquier_apify_leads').update({ email: item.email }).eq('id', matchedLead.id)
      }
      leads.push({
        source: 'li_enrichment',
        actor_run_id: runId,
        company: item.company || item.currentCompany || null,
        name: item.name || item.fullName || null,
        email: item.email || null,
        linkedin_url: item.profileUrl || item.url || null,
        website: null,
        description: item.headline || item.title || null,
        raw: item,
      })
    }
  } catch (err) {
    log(`⚠️  LinkedIn Enrichment: ${err.message}`)
  }
  return leads
}

async function fetchShopifyStores(log) {
  const queries = AQUIER_LEAD_QUERIES.slice(0, 1)
  const leads = []
  for (const query of queries) {
    try {
      const { items, runId } = await runAndCollect(
        ACTORS.SHOPIFY_FINDER,
        { searchQuery: query, maxResults: 50 },
        { timeoutMs: 180_000 },
      )
      log(`Shopify Finder "${query}" → ${items.length} stores`)
      for (const item of items) {
        if (!item.url && !item.website) continue
        leads.push({
          source: 'shopify_finder',
          actor_run_id: runId,
          company: item.shopName || item.name || null,
          name: item.ownerName || null,
          email: item.email || null,
          linkedin_url: null,
          website: item.url || item.website || null,
          description: item.description || item.niche || null,
          raw: item,
        })
      }
    } catch (err) {
      log(`⚠️  Shopify Finder "${query}": ${err.message}`)
    }
  }
  return leads
}

export async function run(log = console.log) {
  log('[aquier-leads] start')
  const started = Date.now()

  const [b2bLeads, ycLeads, gmapsLeads, apolloLeads, linkedinLeads, jobLeads, crunchbaseLeads, careerLeads, wellfoundLeads, companyIntelLeads, liEnrichLeads, shopifyLeads] = await Promise.all([
    fetchB2BLeads(log),
    fetchYCombinatorLeads(log),
    fetchGoogleMapsLeads(log),
    fetchApolloLeads(log),
    fetchLinkedInLeads(log),
    fetchJobSignals(log),
    fetchCrunchbaseLeads(log),
    fetchCareerATS(log),
    fetchWellfoundLeads(log),
    fetchCompanyIntelLeads(log),
    fetchLinkedInEnrichment(log),
    fetchShopifyStores(log),
  ])

  const allLeads = [...b2bLeads, ...ycLeads, ...gmapsLeads, ...apolloLeads, ...linkedinLeads, ...jobLeads, ...crunchbaseLeads, ...careerLeads, ...wellfoundLeads, ...companyIntelLeads, ...liEnrichLeads, ...shopifyLeads]
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
  await heartbeat(ENGINE_KEY, { saved, skipped, b2b: b2bLeads.length, yc: ycLeads.length, gmaps: gmapsLeads.length, apollo: apolloLeads.length, linkedin: linkedinLeads.length, jobs: jobLeads.length, crunchbase: crunchbaseLeads.length, career: careerLeads.length, wellfound: wellfoundLeads.length, company_intel: companyIntelLeads.length, li_enrich: liEnrichLeads.length, shopify: shopifyLeads.length, ms })
  log(`[aquier-leads] klaar in ${ms}ms — ${saved} opgeslagen, ${skipped} duplicaten (B2B:${b2bLeads.length} YC:${ycLeads.length} Maps:${gmapsLeads.length} Apollo:${apolloLeads.length} LI:${linkedinLeads.length} Jobs:${jobLeads.length} CB:${crunchbaseLeads.length} ATS:${careerLeads.length} WF:${wellfoundLeads.length} CI:${companyIntelLeads.length} LI-E:${liEnrichLeads.length} Shopify:${shopifyLeads.length})`)
  return { saved, skipped }
}
