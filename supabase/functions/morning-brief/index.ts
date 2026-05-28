import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BriefingResult {
  per_entity: Array<{
    entity: string;
    orlando_tasks: string[];
    ai_ceo_tasks: string[];
    approvals_pending: string[];
  }>;
  critical_alerts: string[];
  this_week_top3: string[];
  summary: string;
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

    // Check if brief already exists for today
    const { data: existingBrief } = await supabase
      .from("morning_briefs")
      .select("id")
      .eq("date", today)
      .maybeSingle();

    if (existingBrief) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Brief already generated today",
          date: today,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get latest ai_ceo_run
    const { data: latestRun } = await supabase
      .from("ai_ceo_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get pending approvals
    const { data: pendingApprovals } = await supabase
      .from("approval_queue")
      .select("*")
      .in("status", ["pending", "awaiting_approval"]);

    // Generate briefing via Claude
    const briefing = await generateBriefing(
      latestRun,
      pendingApprovals || [],
      Deno.env.get("ANTHROPIC_API_KEY") || ""
    );

    // Store the briefing
    const { error: insertError } = await supabase
      .from("morning_briefs")
      .insert({
        date: today,
        generated_by: "IRIS",
        orlando_tasks: getOrlandoTasks(latestRun),
        ai_ceo_tasks_today: getAICEOTasks(latestRun),
        approvals_pending: getApprovalsSummary(pendingApprovals || []),
        per_entity: briefing.per_entity,
        summary: briefing.summary,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store briefing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        briefing: {
          summary: briefing.summary,
          critical_alerts: briefing.critical_alerts,
          per_entity: briefing.per_entity,
          this_week_top3: briefing.this_week_top3,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Morning brief error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateBriefing(
  latestRun: any,
  pendingApprovals: any[],
  apiKey: string
): Promise<BriefingResult> {
  const systemPrompt = `You are IRIS, the communication agent of Orlando's AI company.
Your task: generate a clear, concise morning briefing for Orlando.

Orlando is a busy entrepreneur. The briefing must be readable in 60 seconds.

Structure PER ENTITY (only entities with activity today):
[ENTITY NAME]
→ JIJ VANDAAG: [concrete tasks only Orlando can do, max 3 bullets]
→ AI CEO VANDAAG: [what ORLAND-O and team execute autonomously, max 3 bullets]
→ WACHT OP JOU: [open approvals, max 2 bullets]

At the end:
KRITIEKE ALERTS: [only truly urgent items]
DEZE WEEK: [top 3 priorities for the whole week]

Tone: direct, business-like, no unnecessary words. Write as a trusted EA briefing Orlando every morning.
Return ONLY valid JSON with fields: per_entity (array), critical_alerts, this_week_top3, summary`;

  const userPrompt = `Generate morning briefing for today:

AI CEO Run (latest): ${JSON.stringify(latestRun, null, 2)}

Pending Approvals: ${JSON.stringify(pendingApprovals, null, 2)}

Generate the briefing in JSON format.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-1-20250805",
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

  return JSON.parse(content.text);
}

function getOrlandoTasks(run: any): any[] {
  if (!run || !run.orlando_personal_tasks) return [];
  return run.orlando_personal_tasks;
}

function getAICEOTasks(run: any): any[] {
  if (!run || !run.execution_plan) return [];
  return run.execution_plan
    .filter((item: any) => item.type === "AUTONOMOUS")
    .slice(0, 5);
}

function getApprovalsSummary(approvals: any[]): any[] {
  return approvals.map((a) => ({
    title: a.title,
    entity: a.entity,
    priority_score: a.priority_score,
  }));
}
