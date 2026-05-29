import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StrategicInsight {
  type: "opportunity" | "risk" | "growth";
  title: string;
  description: string;
  priority: number;
  action_required: boolean;
  related_metrics: string[];
}

interface StrategicReport {
  date: string;
  insights: StrategicInsight[];
  summary: string;
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const today = new Date().toISOString().split("T")[0];
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch KPI snapshots for trend analysis
    const { data: kpiSnapshots } = await supabase
      .from("osil_kpi_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(30);

    // Fetch active opportunities
    const { data: opportunities } = await supabase
      .from("osil_opportunities")
      .select("*")
      .eq("status", "active")
      .order("expected_value", { ascending: false });

    // Fetch unacknowledged alerts
    const { data: alerts } = await supabase
      .from("osil_alerts")
      .select("*")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false });

    // Fetch company milestones
    const { data: milestones } = await supabase
      .from("milestones")
      .select("*")
      .eq("is_active", true)
      .order("target_date", { ascending: true });

    // Generate insights via Claude
    const report = await generateStrategicInsights(
      kpiSnapshots || [],
      opportunities || [],
      alerts || [],
      milestones || [],
      anthropicKey
    );

    // Store report for audit trail
    const { error: storeError } = await supabase
      .from("strategic_reports")
      .insert({
        date: today,
        insights: report.insights,
        summary: report.summary,
        recommendations: report.recommendations,
      });

    if (storeError) {
      console.error("Strategic report store error:", storeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Strategic insights error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateStrategicInsights(
  kpiSnapshots: any[],
  opportunities: any[],
  alerts: any[],
  milestones: any[],
  apiKey: string
): Promise<StrategicReport> {
  const today = new Date().toISOString().split("T")[0];

  // Analyze KPI trends
  const recentKpis = kpiSnapshots.slice(0, 7);
  const kpiTrends = {
    cash_trend: recentKpis.length > 1
      ? recentKpis[0].cash_balance - recentKpis[1].cash_balance
      : 0,
    burn_rate_trend: recentKpis.length > 1
      ? recentKpis[0].burn_rate - recentKpis[1].burn_rate
      : 0,
    runway_days: recentKpis[0]?.runway_days || 0,
  };

  const systemPrompt = `You are a strategic business analyst advising Orlando on growth opportunities and risks.

Your role: Synthesize financial data, market opportunities, and operational alerts into actionable strategic insights.

Analyze:
1. KPI Trends: Cash flow patterns, burn rate changes, runway implications
2. Active Opportunities: Acquisition targets, partnership deals, revenue expansion channels
3. Critical Alerts: Operational risks, compliance issues, dependency blockers
4. Milestone Alignment: Prioritize insights that advance active milestones

Output exactly 3-5 strategic insights, each with:
- Type: "opportunity", "risk", or "growth"
- Priority: 1-10 score
- Action Required: true/false
- Clear description of what this means for Orlando

Then provide a concise summary and 2-3 high-impact recommendations.

Return ONLY valid JSON with fields: insights (array), summary (string), recommendations (array).`;

  const userPrompt = `Analyze strategic position for ${today}:

Recent KPI Trends:
- Cash position change: €${kpiTrends.cash_trend.toFixed(2)}
- Burn rate change: €${kpiTrends.burn_rate_trend.toFixed(2)}
- Runway: ${kpiTrends.runway_days} days

Active Opportunities (top 5):
${opportunities.slice(0, 5).map((o) => `- ${o.title}: €${o.expected_value} (${o.target_type})`).join("\n")}

Critical Alerts:
${alerts.length > 0 ? alerts.slice(0, 5).map((a) => `- [${a.severity}] ${a.message}`).join("\n") : "None"}

Active Milestones:
${milestones.map((m) => `- ${m.title} (Due: ${m.target_date}, Status: ${m.status})`).join("\n")}

Generate strategic insights for Orlando's morning briefing.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Claude error:", error);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  const content = data.content[0];

  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  const parsed = JSON.parse(content.text);

  return {
    date: today,
    insights: parsed.insights || [],
    summary: parsed.summary || "",
    recommendations: parsed.recommendations || [],
  };
}
