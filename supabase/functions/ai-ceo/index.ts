import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExecutionItem {
  id: string;
  source_table: string;
  source_id: string | null;
  title: string;
  entity: string;
  assigned_agent: string;
  milestone_alignment: number;
  priority_score: number;
  type: "AUTONOMOUS" | "APPROVAL";
  week: number;
  estimated_hours: number;
  approval_checkpoints: Array<{
    step: number;
    question: string;
    risk_if_yes: string;
    risk_if_no: string;
  }>;
  dispatch_payload: {
    task_type: string;
    objective: Record<string, any>;
  };
}

interface AIResponse {
  summary: string;
  date: string;
  critical_alerts: string[];
  orlando_personal_tasks: Array<{
    title: string;
    entity: string;
    reason: string;
    urgency: "today" | "this_week" | "this_month";
    estimated_minutes: number;
  }>;
  execution_plan: ExecutionItem[];
  blockers: Array<{
    title: string;
    blocks: string[];
    priority_score: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const hermesUrl = Deno.env.get("HERMES_URL") || "http://hermes:3000";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Call Hermes to get incomplete items
    let scanResult;
    try {
      const scanRes = await fetch(`${hermesUrl}/hermes/scan/incomplete`);
      if (!scanRes.ok) throw new Error("Scan failed");
      scanResult = await scanRes.json();
    } catch (e) {
      console.error("Hermes scan error:", e);
      return new Response(
        JSON.stringify({ error: "Failed to scan incomplete items" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Load agent registry for context
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: agents } = await supabase
      .from("agent_registry")
      .select("*")
      .eq("is_active", true);

    // Step 3: Call Claude Opus to analyze and create plan
    const systemPrompt = generateSystemPrompt(agents || []);
    const userPrompt = `Analyze these incomplete items and create an execution plan:

    Incomplete Items: ${JSON.stringify(scanResult.incomplete_items, null, 2)}

    Milestones: ${JSON.stringify(scanResult.milestones, null, 2)}

    Current Date: ${new Date().toISOString().split("T")[0]}

    Generate a detailed execution plan with priorities, assignments, and approval checkpoints.`;

    const aiResponse = await callClaude(anthropicKey, systemPrompt, userPrompt);

    // Step 4: Parse and validate response
    let plan: AIResponse;
    try {
      plan = JSON.parse(aiResponse);
    } catch (e) {
      console.error("Invalid JSON from Claude:", aiResponse);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: Insert into ai_ceo_runs
    const { data: runData, error: runError } = await supabase
      .from("ai_ceo_runs")
      .insert({
        triggered_by: "manual",
        summary: plan.summary,
        critical_alerts: plan.critical_alerts,
        execution_plan: plan.execution_plan,
        orlando_personal_tasks: plan.orlando_personal_tasks,
        blockers: plan.blockers,
        autonomous_dispatched: plan.execution_plan.filter((item) => item.type === "AUTONOMOUS").length,
        approval_queued: plan.execution_plan.filter((item) => item.type === "APPROVAL").length,
      })
      .select("id")
      .single();

    if (runError || !runData) {
      console.error("Failed to insert run:", runError);
      return new Response(
        JSON.stringify({ error: "Failed to store execution plan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 6: Dispatch autonomous tasks & queue approvals
    for (const item of plan.execution_plan) {
      if (item.type === "AUTONOMOUS") {
        // Dispatch to dispatch-task
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-task`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              task_type: item.dispatch_payload.task_type,
              objective: item.dispatch_payload.objective,
              assigned_agent: item.assigned_agent,
              priority_score: item.priority_score,
              source_table: item.source_table,
              source_id: item.source_id,
            }),
          }
        ).catch((e) => console.error("Dispatch error:", e));
      } else {
        // Queue for approval
        await supabase
          .from("approval_queue")
          .insert({
            run_id: runData.id,
            source_table: item.source_table,
            source_id: item.source_id,
            title: item.title,
            entity: item.entity,
            assigned_agent: item.assigned_agent,
            priority_score: item.priority_score,
            week: item.week,
            estimated_hours: item.estimated_hours,
            checkpoints: item.approval_checkpoints,
          })
          .catch((e) => console.error("Approval queue error:", e));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runData.id,
        summary: plan.summary,
        autonomous_count: plan.execution_plan.filter((i) => i.type === "AUTONOMOUS").length,
        approval_count: plan.execution_plan.filter((i) => i.type === "APPROVAL").length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI CEO error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateSystemPrompt(agents: any[]): string {
  const agentList = agents.map((a) => `- ${a.name} (${a.role}): ${a.title}`).join("\n");

  return `You are ORLAND-O — the AI CEO twin of Orlando (O.S.M. Amatiskak),
oprichter van de Orlando bedrijvengroep:
- STRKBOUW BV (constructie/bouw, 100%)
- BOUWPROFFS NL BV (constructie, 60%)
- STRKBEHEER BV (vastgoedportefeuille, holding)
- MODIWERIJO FM BV (financieel management, holding)
- MODIWE BV (media / YouTube automatisering)

Je handelt in Orlando's naam. Zijn businessplan en milestones zijn wet (Prio 1).
Jij bent de operationele uitvoerder — Orlando is de Chairman.

Your management team:
${agentList}

Your task:
1. Scoor elk item op milestone-alignment (0-10)
2. Bereken priority_score:
   - milestone_alignment × 0.40
   - urgency (deadline + is blocker) × 0.30
   - entity_weight (holding > operationeel > media) × 0.20
   - dependency_unlock × 0.10
3. Classificeer:
   - AUTONOMOUS: no budget >€500, no prod-deploy risk, no external party, clear scope
   - APPROVAL: one or more criteria apply
4. For APPROVAL: define 2-5 concrete checkpoints
5. Assign to week 1-4
6. Generate orlando_personal_tasks: things only Orlando can do

Rules:
- Milestones are sacred — always above ad-hoc
- Max 5 AUTONOMOUS tasks per day
- Checkpoints must be concrete, not vague
- Items without scope → APPROVAL, checkpoint 1 = "Scope definiëren met Orlando"
- Group by entity within same week

Return ONLY valid JSON.`;
}

async function callClaude(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-1-20250805",
      max_tokens: 4096,
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
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as any;
  const content = data.content[0];

  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return content.text;
}
