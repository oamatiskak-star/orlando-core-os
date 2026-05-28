import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApprovalRequest {
  approval_id: string;
  decision: "approved" | "declined" | "skip";
  note?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const payload: ApprovalRequest = await req.json();

    if (!payload.approval_id || !payload.decision) {
      return new Response(
        JSON.stringify({ error: "Missing approval_id or decision" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Get the approval item
    const { data: approval, error: fetchError } = await supabase
      .from("approval_queue")
      .select("*")
      .eq("id", payload.approval_id)
      .single();

    if (fetchError || !approval) {
      return new Response(
        JSON.stringify({ error: "Approval not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let newStatus = approval.status;
    let nextStep = null;

    if (payload.decision === "declined") {
      newStatus = "declined";
    } else if (payload.decision === "skip") {
      newStatus = "skipped";
    } else if (payload.decision === "approved") {
      const checkpoints = approval.checkpoints as any[];
      const nextCheckpoint = approval.current_checkpoint + 1;

      if (nextCheckpoint >= checkpoints.length) {
        // All checkpoints done — ready to dispatch
        newStatus = "approved";
        nextStep = "dispatch";
      } else {
        // More checkpoints to go
        newStatus = "awaiting_approval";
        nextStep = "next_checkpoint";
      }
    }

    // Update approval with decision
    const { error: updateError } = await supabase
      .from("approval_queue")
      .update({
        status: newStatus,
        last_decision: payload.decision,
        last_decision_at: new Date().toISOString(),
        current_checkpoint:
          payload.decision === "approved" && nextStep === "next_checkpoint"
            ? approval.current_checkpoint + 1
            : approval.current_checkpoint,
      })
      .eq("id", payload.approval_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update approval" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If approved and all checkpoints done, dispatch the task
    if (newStatus === "approved" && nextStep === "dispatch") {
      try {
        await dispatchApprovedTask(approval);
        await supabase
          .from("approval_queue")
          .update({ dispatched_at: new Date().toISOString() })
          .eq("id", payload.approval_id);
      } catch (e) {
        console.error("Dispatch error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        approval_id: payload.approval_id,
        new_status: newStatus,
        next_step: nextStep,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process approval error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function dispatchApprovedTask(approval: any): Promise<void> {
  const dispatchPayload = {
    task_type: approval.source_table,
    objective: {
      source_table: approval.source_table,
      source_id: approval.source_id,
      title: approval.title,
    },
    assigned_agent: approval.assigned_agent,
    priority_score: approval.priority_score,
  };

  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-task`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(dispatchPayload),
    }
  );

  if (!response.ok) {
    throw new Error(`Dispatch failed: ${response.statusText}`);
  }
}
