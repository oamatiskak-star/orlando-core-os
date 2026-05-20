import 'dotenv/config'
import { runAtlasBriefing } from '../agents/atlas'
import { runViralAnalystForContent, runViralAnalystSweep } from '../agents/viral-analyst'
import { runChannelManager, runChannelManagersSweep } from '../agents/channel-manager'
import { runAlgorithmStrategist } from '../agents/algorithm-strategist'
import { runRetentionScientist } from '../agents/retention-scientist'
import { runContentFundManager } from '../agents/content-fund-manager'
import { logger } from '../lib/logger'

async function main() {
  const [, , agentArg, idArg] = process.argv

  if (!agentArg) {
    console.error('Usage: ts-node src/cli/run-agent.ts <agent> [target_id]')
    console.error('Agents: atlas | viral-analyst | viral-analyst-content <content_id> | channel-managers | channel-manager <channel_id> | algorithm-strategist | retention-scientist | content-fund-manager')
    process.exit(1)
  }

  try {
    switch (agentArg) {
      case 'atlas':
        console.log(JSON.stringify(await runAtlasBriefing(), null, 2))
        break
      case 'viral-analyst':
        console.log(JSON.stringify(await runViralAnalystSweep(), null, 2))
        break
      case 'viral-analyst-content':
        if (!idArg) throw new Error('content_id required')
        console.log(JSON.stringify(await runViralAnalystForContent(idArg), null, 2))
        break
      case 'channel-managers':
        console.log(JSON.stringify(await runChannelManagersSweep(), null, 2))
        break
      case 'channel-manager':
        if (!idArg) throw new Error('channel_id required')
        console.log(JSON.stringify(await runChannelManager(idArg), null, 2))
        break
      case 'algorithm-strategist':
        console.log(JSON.stringify(await runAlgorithmStrategist(), null, 2))
        break
      case 'retention-scientist':
        console.log(JSON.stringify(await runRetentionScientist(), null, 2))
        break
      case 'content-fund-manager':
        console.log(JSON.stringify(await runContentFundManager(), null, 2))
        break
      default:
        throw new Error(`Unknown agent: ${agentArg}`)
    }
    process.exit(0)
  } catch (err) {
    logger.error('Run failed', { err: err instanceof Error ? err.message : String(err) })
    process.exit(1)
  }
}

main()
