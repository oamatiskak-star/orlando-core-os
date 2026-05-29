import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExecutiveSnapshot {
  date: string;
  financial: {
    total_cash_balance: number;
    total_burn_rate: number;
    runway_days: number;
    entities: Array<{
      entity: string;
      cash_balance: number;
      burn_rate: number;
      runway_days: number;
    }>;
  };
  pending_approvals: Array<{
    id: string;
    title: string;
    entity: string;
    priority_score: number;
    urgency: string;
  }>;
  agent_status: Array<{
    name: string;
    role: string;
    status: string;
    current_task: string | null;
    last_activity: string | null;
  }>;
  critical_alerts: string[];
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

    // Fetch financial snapshots from osil_kpi_snapshots
    const { data: kpiSnapshots } = await supabase
      .from("osil_kpi_snapshots")
      .select("*")
      .eq("snapshot_date", today)
      .order("created_at", { ascending: false });

    // Fetch pending approvals
    const { data: pendingApprovals } = await supabase
      .from("approval_queue")
      .select("*")
      .in("status", ["pending", "awaiting_approval"])
      .order("priority_score", { ascending: false });

    // Fetch agent status
    const { data: agents } = await supabase
      .from("agent_registry")
      .select("*")
      .eq("is_active", true);

    // Fetch critical alerts from osil_alerts
    const { data: alerts } = await supabase
      .from("osil_alerts")
      .select("*")
      .eq("severity", "critical")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false });

    // Aggregate financial data by entity
    const financialByEntity: Record<string, any> = {};
    let totalCash = 0;
    let totalBurnRate = 0;
    let minRunway = Infinity;

    if (kpiSnapshots) {
      for (const snapshot of kpiSnapshots) {
        const entity = snapshot.company_name || "Unknown";
        if (!financialByEntity[entity]) {
          financialByEntity[entity] = {
            entity,
            cash_balance: 0,
            burn_rate: 0,
            runway_days: 0,
          };
        }
        financialByEntity[entity].cash_balance = snapshot.cash_balance || 0;
        financialByEntity[entity].burn_rate = snapshot.burn_rate || 0;
        financialByEntity[entity].runway_days = snapshot.runway_days || 0;

        totalCash += snapshot.cash_balance || 0;
        totalBurnRate += snapshot.burn_rate || 0;
        minRunway = Math.min(minRunway, snapshot.runway_days || 0);
      }
    }

    // Format pending approvals
    const formattedApprovals = (pendingApprovals || []).map((approval) => ({
      id: approval.id,
      title: approval.title,
      entity: approval.entity,
      priority_score: approval.priority_score,
      urgency: approval.priority_score > 7 ? "urgent" : approval.priority_score > 5 ? "high" : "normal",
    }));

    // Format agent status
    const formattedAgents = (agents || []).map((agent) => ({
      name: agent.name,
      role: agent.role,
      status: agent.status || "idle",
      current_task: agent.current_task || null,
      last_activity: agent.last_activity || null,
    }));

    // Format critical alerts
    const criticalAlerts = (alerts || []).map((alert) => alert.message);

    // Calculate runway
    const runway = totalBurnRate > 0 ? Math.floor(totalCash / totalBurnRate) : Infinity;

    const snapshot: ExecutiveSnapshot = {
      date: today,
      financial: {
        total_cash_balance: totalCash,
        total_burn_rate: totalBurnRate,
        runway_days: runway === Infinity ? 0 : runway,
        entities: Object.values(financialByEntity),
      },
      pending_approvals: formattedApprovals,
      agent_status: formattedAgents,
      critical_alerts: criticalAlerts,
    };

    // Store snapshot for audit trail
    const { error: storeError } = await supabase
      .from("executive_snapshots")
      .insert({
        date: today,
        financial: snapshot.financial,
        pending_approvals: snapshot.pending_approvals,
        agent_status: snapshot.agent_status,
        critical_alerts: snapshot.critical_alerts,
      });

    if (storeError) {
      console.error("Snapshot store error:", storeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily executive snapshot error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
