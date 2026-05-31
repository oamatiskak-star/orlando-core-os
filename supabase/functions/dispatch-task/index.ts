import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DispatchPayload {
  task_type: string;
  objective: Record<string, any>;
  assigned_agent: string;
  priority_score?: number;
  source_table?: string;
  source_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: DispatchPayload = await req.json();

    if (!payload.task_type || !payload.objective || !payload.assigned_agent) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Log task dispatch
    const { error: logError } = await supabase
      .from("hermes")
      .from("workflow_runs")
      .insert({
        triggered_by: "dispatch-task",
        trigger_payload: payload,
        status: "running",
      });

    if (logError) {
      console.error("Failed to log dispatch:", logError);
    }

    // Route to appropriate agent/worker
    const dispatchResult = await routeTask(payload);

    return new Response(
      JSON.stringify({
        success: true,
        task_type: payload.task_type,
        assigned_agent: payload.assigned_agent,
        dispatch_result: dispatchResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dispatch error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function routeTask(payload: DispatchPayload): Promise<string> {
  // This function will grow as we add worker integrations
  // For now, return success - actual routing happens via agent-specific handlers
  return `Task routed to ${payload.assigned_agent}`;
}
