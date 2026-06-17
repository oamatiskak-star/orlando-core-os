import { APIFY_TOKEN } from '../config.mjs'

const BASE = 'https://api.apify.com/v2'

async function apiFetch(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${BASE}${path}${sep}token=${APIFY_TOKEN}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Apify ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

export async function runActor(actorId, input) {
  const slug = actorId.replace('/', '~')
  const data = await apiFetch(`/acts/${slug}/runs`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.data
}

export async function getRunStatus(runId) {
  const data = await apiFetch(`/actor-runs/${runId}`)
  return data.data
}

export async function waitForRun(runId, { pollMs = 6000, timeoutMs = 600_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const run = await getRunStatus(runId)
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) return run
    await new Promise(r => setTimeout(r, pollMs))
  }
  throw new Error(`Run ${runId} timed out na ${timeoutMs / 1000}s`)
}

export async function getDatasetItems(datasetId, { limit = 2000 } = {}) {
  const data = await apiFetch(`/datasets/${datasetId}/items?limit=${limit}&clean=true`)
  return Array.isArray(data) ? data : (data.items ?? [])
}

export async function runAndCollect(actorId, input, opts = {}) {
  if (!APIFY_TOKEN) throw new Error('APIFY_API_TOKEN niet geconfigureerd')
  const run = await runActor(actorId, input)
  const finished = await waitForRun(run.id, opts)
  if (finished.status !== 'SUCCEEDED') {
    throw new Error(`Actor ${actorId} eindigde met status: ${finished.status}`)
  }
  return { items: await getDatasetItems(finished.defaultDatasetId), runId: run.id }
}
