import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { sendSlackNotification } from "./lib/slack";
import { sendTelegramNotification } from "./lib/telegram";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChannelMetrics {
  channelId: string;
  channelName: string;
  totalViews: number;
  totalSubscribers: number;
  subscriberGap: number;
  gapPercentage: number;
  conversionRate: number;
  healthScore: number;
  growth48h: number;
  cluster: "Shorts US" | "NL long-form" | "Aquier control";
}

interface ClusterStatus {
  cluster: string;
  channels: ChannelMetrics[];
  activeTests: string[];
  testWinner: string | null;
  readyForPhaseTransition: boolean;
}

async function fetchChannelMetrics(): Promise<ChannelMetrics[]> {
  const { data: reports, error } = await supabase
    .from("channel_analyst_reports")
    .select(
      `
      channel_id,
      total_views,
      total_subscribers,
      subscriber_gap,
      subscriber_gap_percent,
      subscriber_conversion_rate,
      health_score,
      growth_48h,
      analyzed_at
    `
    )
    .order("analyzed_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Error fetching channel metrics:", error);
    return [];
  }

  const { data: channels } = await supabase
    .from("youtube_channels")
    .select("id, name, cluster");

  const channelMap = new Map(channels?.map((c) => [c.id, c]) || []);

  return (reports || []).map((report) => {
    const channel = channelMap.get(report.channel_id);
    return {
      channelId: report.channel_id,
      channelName: channel?.name || "Unknown",
      totalViews: report.total_views || 0,
      totalSubscribers: report.total_subscribers || 0,
      subscriberGap: report.subscriber_gap || 0,
      gapPercentage: report.subscriber_gap_percent || 0,
      conversionRate: report.subscriber_conversion_rate || 0,
      healthScore: report.health_score || 0,
      growth48h: report.growth_48h || 0,
      cluster: channel?.cluster || "Unknown",
    };
  });
}

async function fetchABTestStatus(cluster: string): Promise<string[]> {
  const { data: abTests } = await supabase
    .from("ab_tests")
    .select("id, type, status")
    .eq("cluster", cluster)
    .eq("status", "active");

  return (abTests || []).map((test) => `${test.type} (${test.status})`);
}

async function analyzeClusterPerformance(
  channels: ChannelMetrics[]
): Promise<ClusterStatus[]> {
  const clusters = ["Shorts US", "NL long-form", "Aquier control"];
  const clusterStatuses: ClusterStatus[] = [];

  for (const cluster of clusters) {
    const clusterChannels = channels.filter((c) => c.cluster === cluster);
    const activeTests = await fetchABTestStatus(cluster);

    const avgHealthScore =
      clusterChannels.reduce((sum, c) => sum + c.healthScore, 0) /
      clusterChannels.length;
    const avgGrowth =
      clusterChannels.reduce((sum, c) => sum + c.growth48h, 0) /
      clusterChannels.length;

    clusterStatuses.push({
      cluster,
      channels: clusterChannels,
      activeTests,
      testWinner: avgGrowth > 12 ? "Current strategy performing well" : null,
      readyForPhaseTransition: avgHealthScore > 70 && avgGrowth > 8,
    });
  }

  return clusterStatuses;
}

async function generateDailyStandup(): Promise<string> {
  const now = new Date();
  const timestamp = now.toISOString().split("T")[0];

  const metrics = await fetchChannelMetrics();
  const clusterStatuses = await analyzeClusterPerformance(metrics);

  let report = `
📊 **ORLANDO PROJECT MANAGER DAILY STANDUP** — ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📈 12-CHANNEL OVERVIEW**

Total Channels: ${metrics.length}
Avg Health Score: ${(metrics.reduce((sum, c) => sum + c.healthScore, 0) / metrics.length).toFixed(1)}/100
Avg Growth (48h): ${(metrics.reduce((sum, c) => sum + c.growth48h, 0) / metrics.length).toFixed(1)}%
Total Views Across All Channels: ${metrics.reduce((sum, c) => sum + c.totalViews, 0).toLocaleString()}
Total Subscribers Across All Channels: ${metrics.reduce((sum, c) => sum + c.totalSubscribers, 0).toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${clusterStatuses
  .map(
    (cluster) => `
**🎯 CLUSTER: ${cluster.cluster}**

${cluster.channels
  .map(
    (ch) => `
  📌 ${ch.channelName}
     Views: ${ch.totalViews.toLocaleString()} | Subs: ${ch.totalSubscribers.toLocaleString()} | Health: ${ch.healthScore}/100
     Gap: ${ch.subscriberGap} subs (${ch.gapPercentage.toFixed(1)}%) | Conversion: ${ch.conversionRate.toFixed(3)}%
     Growth (48h): ${ch.growth48h.toFixed(1)}% ${ch.growth48h > 10 ? "📈" : ch.growth48h > 0 ? "➡️" : "📉"}
`
  )
  .join("")}

Active A/B Tests: ${cluster.activeTests.length > 0 ? cluster.activeTests.join(", ") : "None"}
Test Winner: ${cluster.testWinner || "Testing in progress"}
Phase Transition Ready: ${cluster.readyForPhaseTransition ? "✅ YES" : "⏳ In Progress"}
`
  )
  .join("\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**⚠️  ALERTS & ACTION ITEMS**

${(() => {
  const alerts: string[] = [];

  // Check for critical subscriber gaps
  const criticalGaps = metrics.filter((c) => c.gapPercentage > 75);
  if (criticalGaps.length > 0) {
    alerts.push(
      `🔴 CRITICAL SUBSCRIBER GAPS: ${criticalGaps.map((c) => c.channelName).join(", ")}`
    );
  }

  // Check for low health scores
  const lowHealth = metrics.filter((c) => c.healthScore < 50);
  if (lowHealth.length > 0) {
    alerts.push(
      `⚠️  LOW HEALTH SCORES: ${lowHealth.map((c) => c.channelName).join(", ")}`
    );
  }

  // Check for negative growth
  const negativeGrowth = metrics.filter((c) => c.growth48h < 0);
  if (negativeGrowth.length > 0) {
    alerts.push(
      `📉 NEGATIVE GROWTH: ${negativeGrowth.map((c) => c.channelName).join(", ")}`
    );
  }

  return alerts.length > 0 ? alerts.join("\n") : "✅ No critical alerts";
})()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**📋 TODAY'S PRIORITIES**

1. Monitor A/B tests in all clusters
2. Execute high-priority subscriber growth recommendations
3. Verify YouTube algorithm compliance (no "inauthentic content" flags)
4. Check monetization threshold progress (1000 subs / 4000 watch hours)
5. Prepare phase transition checklist if cluster-ready

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated at: ${now.toLocaleString()}
Analyst & Marketing reports integrated ✓
`;

  return report;
}

async function sendDailyReport(): Promise<void> {
  try {
    const report = await generateDailyStandup();

    // Send to Slack
    await sendSlackNotification(
      process.env.SLACK_WEBHOOK_CRITICAL || "",
      report,
      "orlando-critical"
    );

    // Log to file
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

    const logFile = path.join(logDir, "project-manager.log");
    fs.appendFileSync(logFile, `${report}\n\n${"=".repeat(80)}\n\n`);

    console.log("✅ Daily standup report generated and sent");
  } catch (error) {
    console.error("Error sending daily report:", error);
  }
}

export async function startProjectManager(): Promise<void> {
  // Run daily standup at 9 AM
  const scheduleDaily = (): void => {
    const now = new Date();
    const target = new Date();
    target.setHours(9, 0, 0, 0);

    if (now > target) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    console.log(
      `⏰ Project Manager initialized. Next standup in ${(delay / 1000 / 3600).toFixed(1)} hours`
    );

    setTimeout(() => {
      sendDailyReport();
      setInterval(sendDailyReport, 24 * 60 * 60 * 1000); // Daily
    }, delay);
  };

  scheduleDaily();

  // Also run immediately for testing
  await sendDailyReport();
}

if (require.main === module) {
  startProjectManager().catch(console.error);
}
