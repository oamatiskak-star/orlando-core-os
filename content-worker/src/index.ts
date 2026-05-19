import 'dotenv/config'
import cron from 'node-cron'
import { CHANNEL_CONFIGS } from './generators/channels'
import { resolveChannels, getQueueDepth, generateVideo } from './generators/generate'

const CRON_SCHEDULE = process.env.CONTENT_WORKER_CRON ?? '*/15 * * * *'

async function run(): Promise<void> {
  console.log('[content-worker] Generation run started:', new Date().toISOString())

  let channelMap
  try {
    channelMap = await resolveChannels(CHANNEL_CONFIGS.map(c => c.name))
  } catch (err) {
    console.error('[content-worker] Channel lookup failed:', (err as Error).message)
    return
  }

  for (const config of CHANNEL_CONFIGS) {
    const channel = channelMap.get(config.name)

    if (!channel) {
      console.warn(`[content-worker] Channel "${config.name}" not found in DB — skipping`)
      continue
    }

    let depth: number
    try {
      depth = await getQueueDepth(channel.id)
    } catch (err) {
      console.error(`[content-worker] Queue depth check failed for ${config.name}:`, (err as Error).message)
      continue
    }

    const needed = config.targetQueueDepth - depth
    if (needed <= 0) {
      console.log(`[${config.name}] Queue depth ${depth}/${config.targetQueueDepth} — OK, no generation needed`)
      continue
    }

    const toGenerate = Math.min(needed, config.batchSize)
    console.log(`[${config.name}] Queue depth ${depth}/${config.targetQueueDepth} — generating ${toGenerate} videos`)

    let queryIndex = Math.floor(Math.random() * config.pexelsQueries.length)
    let generated = 0
    let attempts = 0
    const maxAttempts = toGenerate * 3

    while (generated < toGenerate && attempts < maxAttempts) {
      attempts++
      try {
        const ok = await generateVideo(config, channel, queryIndex)
        if (ok) {
          generated++
          queryIndex = (queryIndex + 1) % config.pexelsQueries.length
        } else {
          // Try a different query on failure
          queryIndex = (queryIndex + 2) % config.pexelsQueries.length
        }

        // Brief pause to respect Pexels rate limits (200 req/hour)
        await sleep(2000)

      } catch (err) {
        console.error(`[${config.name}] Generation attempt ${attempts} failed:`, (err as Error).message)
        queryIndex = (queryIndex + 1) % config.pexelsQueries.length
        await sleep(5000)
      }
    }

    console.log(`[${config.name}] Done: ${generated}/${toGenerate} videos generated`)
  }

  console.log('[content-worker] Generation run complete:', new Date().toISOString())
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run once immediately on start
run().catch(err => console.error('[content-worker] Initial run failed:', err))

// Then run on schedule
cron.schedule(CRON_SCHEDULE, async () => {
  try {
    await run()
  } catch (err) {
    console.error('[content-worker] Scheduled run failed:', err)
  }
})

console.log(`[content-worker] Started. Schedule: ${CRON_SCHEDULE}`)
console.log(`[content-worker] Channels: ${CHANNEL_CONFIGS.map(c => c.name).join(', ')}`)
