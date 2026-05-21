import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SlackMessage {
  channel: string
  blocks?: Array<any>
  text?: string
  attachments?: Array<any>
}

async function sendSlackMessage(webhook: string, message: SlackMessage): Promise<void> {
  try {
    await axios.post(webhook, message)
  } catch (err) {
    console.error('[slack-discord] Error sending to Slack:', err)
  }
}

async function sendDiscordMessage(webhook: string, embed: any): Promise<void> {
  try {
    await axios.post(webhook, { embeds: [embed] })
  } catch (err) {
    console.error('[slack-discord] Error sending to Discord:', err)
  }
}

async function notifyBehindSchedule(): Promise<void> {
  const { data: kpis } = await supabase
    .from('marketing_kpis_realtime')
    .select('*, youtube_channels(name)')
    .eq('on_track', false)

  if (!kpis || kpis.length === 0) return

  for (const kpi of kpis) {
    const channel = (kpi as any).youtube_channels
    const deficit = kpi.goal_views - (kpi.current_progress_percent / 100) * kpi.goal_views
    const daysLeft = kpi.days_remaining
    const dailyNeeded = daysLeft > 0 ? Math.ceil(deficit / daysLeft) : 0

    const slackPayload: SlackMessage = {
      channel: '#orlando-critical',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 CRITICAL: Channel Behind Target'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Channel:*\n${channel.name}`
            },
            {
              type: 'mrkdwn',
              text: `*Progress:*\n${kpi.current_progress_percent.toFixed(1)}%`
            },
            {
              type: 'mrkdwn',
              text: `*Current:*\n${(
                (kpi.current_progress_percent / 100) * kpi.goal_views
              ).toLocaleString()} views`
            },
            {
              type: 'mrkdwn',
              text: `*Target:*\n${kpi.goal_views.toLocaleString()} views`
            },
            {
              type: 'mrkdwn',
              text: `*Days Left:*\n${daysLeft}`
            },
            {
              type: 'mrkdwn',
              text: `*Daily Need:*\n${dailyNeeded.toLocaleString()} views/day`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Action Required:*\n• Execute high-priority recommendations\n• Consider upload burst (2-3x/week)\n• Optimize CTR with A/B testing`
          }
        }
      ]
    }

    if (process.env.SLACK_WEBHOOK_CRITICAL) {
      await sendSlackMessage(process.env.SLACK_WEBHOOK_CRITICAL, slackPayload)
    }

    if (process.env.DISCORD_WEBHOOK_CRITICAL) {
      const discordEmbed = {
        title: '🚨 Channel Behind Schedule',
        description: `${channel.name} is only at ${kpi.current_progress_percent.toFixed(1)}% of the 840k goal`,
        color: 0xff0000,
        fields: [
          {
            name: 'Current Progress',
            value: `${(
              (kpi.current_progress_percent / 100) * kpi.goal_views
            ).toLocaleString()} / ${kpi.goal_views.toLocaleString()} views`,
            inline: true
          },
          {
            name: 'Days Remaining',
            value: `${daysLeft} days`,
            inline: true
          },
          {
            name: 'Daily Velocity Needed',
            value: `${dailyNeeded.toLocaleString()} views/day`,
            inline: false
          }
        ],
        footer: {
          text: 'Marketing Orchestration System'
        }
      }

      await sendDiscordMessage(process.env.DISCORD_WEBHOOK_CRITICAL, discordEmbed)
    }
  }
}

async function notifyViralMomentum(): Promise<void> {
  const { data: kpis } = await supabase
    .from('marketing_kpis_realtime')
    .select('*, youtube_channels(name)')
    .gt('growth_rate_percent', 50)

  if (!kpis || kpis.length === 0) return

  for (const kpi of kpis) {
    const channel = (kpi as any).youtube_channels

    const slackPayload: SlackMessage = {
      channel: '#orlando-marketing',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚀 VIRAL MOMENTUM DETECTED!'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${channel.name}* is experiencing ${kpi.growth_rate_percent.toFixed(
              1
            )}% growth!\n\n_Time to capitalize on this momentum._`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*24h Views:*\n${kpi.views_24h.toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*7d Views:*\n${kpi.views_7d.toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Viral Score:*\n${kpi.viral_momentum_score.toFixed(0)}/100`
            },
            {
              type: 'mrkdwn',
              text: `*Health Score:*\n${kpi.health_score}/100`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Quick Actions:*\n1. Upload similar content immediately\n2. Cross-promote viral video\n3. Engage with comments aggressively\n4. Consider live stream to capitalize`
          }
        }
      ]
    }

    if (process.env.SLACK_WEBHOOK_MARKETING) {
      await sendSlackMessage(process.env.SLACK_WEBHOOK_MARKETING, slackPayload)
    }

    if (process.env.DISCORD_WEBHOOK_MARKETING) {
      const discordEmbed = {
        title: '🚀 Viral Momentum!',
        description: `${channel.name} is experiencing explosive growth!`,
        color: 0x00ff00,
        fields: [
          {
            name: 'Growth Rate',
            value: `${kpi.growth_rate_percent.toFixed(1)}%`,
            inline: true
          },
          {
            name: 'Viral Score',
            value: `${kpi.viral_momentum_score.toFixed(0)}/100`,
            inline: true
          },
          {
            name: 'Views (24h)',
            value: `${kpi.views_24h.toLocaleString()}`,
            inline: false
          },
          {
            name: 'Action',
            value: 'Upload similar content immediately & engage aggressively',
            inline: false
          }
        ],
        footer: {
          text: 'Marketing Orchestration System'
        }
      }

      await sendDiscordMessage(process.env.DISCORD_WEBHOOK_MARKETING, discordEmbed)
    }
  }
}

async function notifyNewRecommendation(): Promise<void> {
  const { data: recs } = await supabase
    .from('marketing_recommendations')
    .select('*, youtube_channels(name)')
    .eq('status', 'pending')
    .gte('ai_confidence', 0.8)
    .order('priority', { ascending: false })
    .limit(1)

  if (!recs || recs.length === 0) return

  const rec = recs[0] as any

  const slackPayload: SlackMessage = {
    channel: '#orlando-marketing',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '💡 High-Confidence Recommendation'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${rec.title}*\n${rec.description}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Channel:*\n${rec.youtube_channels.name}`
          },
          {
            type: 'mrkdwn',
            text: `*Confidence:*\n${(rec.ai_confidence * 100).toFixed(0)}%`
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${rec.recommendation_type}`
          },
          {
            type: 'mrkdwn',
            text: `*Est. Impact:*\n+${rec.estimated_impact_views.toLocaleString()} views`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Action Items:*\n${rec.action_items.map((item: string) => `• ${item}`).join('\n')}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Execute Now'
            },
            value: `execute_${rec.id}`,
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Schedule Later'
            },
            value: `schedule_${rec.id}`
          }
        ]
      }
    ]
  }

  if (process.env.SLACK_WEBHOOK_MARKETING) {
    await sendSlackMessage(process.env.SLACK_WEBHOOK_MARKETING, slackPayload)
  }

  if (process.env.DISCORD_WEBHOOK_MARKETING) {
    const discordEmbed = {
      title: `💡 ${rec.title}`,
      description: rec.description,
      color: 0x0099ff,
      fields: [
        {
          name: 'Channel',
          value: rec.youtube_channels.name,
          inline: true
        },
        {
          name: 'Confidence',
          value: `${(rec.ai_confidence * 100).toFixed(0)}%`,
          inline: true
        },
        {
          name: 'Estimated Impact',
          value: `+${rec.estimated_impact_views.toLocaleString()} views`,
          inline: true
        },
        {
          name: 'Action Items',
          value: rec.action_items.map((item: string) => `• ${item}`).join('\n'),
          inline: false
        }
      ],
      footer: {
        text: 'Marketing Orchestration System'
      }
    }

    await sendDiscordMessage(process.env.DISCORD_WEBHOOK_MARKETING, discordEmbed)
  }
}

async function notifyABTestWinner(): Promise<void> {
  const { data: tests } = await supabase
    .from('ab_test_variants')
    .select('*, youtube_videos(title)')
    .eq('status', 'concluded')
    .gte('confidence_level', 0.95)
    .order('concluded_at', { ascending: false })
    .limit(1)

  if (!tests || tests.length === 0) return

  const test = tests[0] as any
  const isWinnerA = test.winner === 'A'
  const winnerValue = isWinnerA ? test.variant_a_value : test.variant_b_value
  const improvement =
    ((isWinnerA ? test.variant_a_ctr - test.variant_b_ctr : test.variant_b_ctr - test.variant_a_ctr) /
      Math.min(test.variant_a_ctr, test.variant_b_ctr)) *
    100

  const slackPayload: SlackMessage = {
    channel: '#orlando-tests',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `✅ A/B Test Winner: Variant ${test.winner}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${test.youtube_videos.title}*\n${test.variant_type.toUpperCase()} Test`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Winner:*\n${winnerValue}`
          },
          {
            type: 'mrkdwn',
            text: `*Improvement:*\n+${improvement.toFixed(1)}%`
          },
          {
            type: 'mrkdwn',
            text: `*Confidence:*\n${(test.confidence_level * 100).toFixed(0)}%`
          },
          {
            type: 'mrkdwn',
            text: `*Views:*\nA: ${test.variant_a_views} | B: ${test.variant_b_views}`
          }
        ]
      }
    ]
  }

  if (process.env.SLACK_WEBHOOK_TESTS) {
    await sendSlackMessage(process.env.SLACK_WEBHOOK_TESTS, slackPayload)
  }

  if (process.env.DISCORD_WEBHOOK_TESTS) {
    const discordEmbed = {
      title: `✅ A/B Test Winner: Variant ${test.winner}`,
      description: `${test.youtube_videos.title} - ${test.variant_type.toUpperCase()} Test`,
      color: 0x00ff00,
      fields: [
        {
          name: 'Winner',
          value: winnerValue,
          inline: false
        },
        {
          name: 'Improvement',
          value: `+${improvement.toFixed(1)}%`,
          inline: true
        },
        {
          name: 'Confidence',
          value: `${(test.confidence_level * 100).toFixed(0)}%`,
          inline: true
        }
      ],
      footer: {
        text: 'Marketing Orchestration System'
      }
    }

    await sendDiscordMessage(process.env.DISCORD_WEBHOOK_TESTS, discordEmbed)
  }
}

async function main() {
  console.log('[slack-discord] Marketing notification service started')

  // Check for notifications every 10 minutes
  const notifyAll = async () => {
    console.log('[slack-discord] Checking for notification triggers...')
    try {
      await notifyBehindSchedule()
      await notifyViralMomentum()
      await notifyNewRecommendation()
      await notifyABTestWinner()
    } catch (err) {
      console.error('[slack-discord] Error in notification cycle:', err)
    }
  }

  // Run immediately
  await notifyAll()

  // Run every 10 minutes
  setInterval(notifyAll, 10 * 60 * 1000)
}

if (require.main === module) {
  main().catch(console.error)
}

export { notifyBehindSchedule, notifyViralMomentum, notifyNewRecommendation, notifyABTestWinner }
