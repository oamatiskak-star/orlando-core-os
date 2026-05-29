import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReconciliationItem {
  entity: string;
  total_transactions: number;
  unreconciled_amount: number;
  unreconciled_count: number;
  tax_status: string;
  account_setup_complete: boolean;
  outstanding_items: string[];
}

interface WeeklyCEOReview {
  date: string;
  week_number: number;
  reconciliation_items: ReconciliationItem[];
  approval_queue_created: number;
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
    const weekNumber = Math.ceil(
      (new Date().getDate() -
        new Date(new Date().getFullYear(), 0, 1).getDay() +
        1) /
        7
    );

    // Check if review already exists for this week
    const { data: existingReview } = await supabase
      .from("weekly_ceo_reviews")
      .select("id")
      .eq("week_number", weekNumber)
      .eq("year", new Date().getFullYear())
      .maybeSingle();

    if (existingReview) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Review already completed this week",
          date: today,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active companies
    const { data: companies } = await supabase
      .from("moneybird_companies")
      .select("*")
      .eq("is_active", true);

    const reconciliationItems: ReconciliationItem[] = [];
    let approvalsCreated = 0;

    if (companies) {
      for (const company of companies) {
        // Count transactions for reconciliation status
        const { data: transactions } = await supabase
          .from("cfo_transactions")
          .select("id, amount, reconciliation_status")
          .eq("company_id", company.id);

        const unreconciledTxs = transactions?.filter(
          (t) => t.reconciliation_status !== "reconciled"
        ) || [];

        const totalUnreconciled = unreconciledTxs.reduce(
          (sum, t) => sum + (t.amount || 0),
          0
        );

        // Check tax filing status
        const { data: taxReservations } = await supabase
          .from("cfo_tax_reservations")
          .select("*")
          .eq("company_id", company.id)
          .eq("is_active", true);

        const taxStatus = !taxReservations || taxReservations.length === 0
          ? "missing_tax_reservations"
          : "tax_configured";

        // Build outstanding items list
        const outstanding: string[] = [];
        if (unreconciledTxs.length > 0) {
          outstanding.push(
            `${unreconciledTxs.length} unreconciled transactions (€${totalUnreconciled.toFixed(2)})`
          );
        }
        if (taxStatus === "missing_tax_reservations") {
          outstanding.push("Tax reservations not configured");
        }

        const item: ReconciliationItem = {
          entity: company.display_name || company.company_name,
          total_transactions: transactions?.length || 0,
          unreconciled_amount: totalUnreconciled,
          unreconciled_count: unreconciledTxs.length,
          tax_status: taxStatus,
          account_setup_complete: outstanding.length === 0,
          outstanding_items: outstanding,
        };

        reconciliationItems.push(item);

        // Create approval items for outstanding issues
        if (outstanding.length > 0) {
          const { error: approvalError } = await supabase
            .from("approval_queue")
            .insert({
              source_table: "weekly_ceo_review",
              source_id: null,
              title: `Weekly Review: ${item.entity} - Reconciliation Required`,
              entity: item.entity,
              assigned_agent: "Orlando",
              priority_score: item.unreconciled_count > 5 ? 8 : 6,
              week: weekNumber,
              estimated_hours: 2,
              status: "pending",
              checkpoints: [
                {
                  step: 1,
                  question: `Review ${item.unreconciled_count} unreconciled transactions for ${item.entity}`,
                  risk_if_yes: "Inaccurate financial reporting",
                  risk_if_no: "Missing transaction visibility",
                },
                {
                  step: 2,
                  question: "Confirm all tax reservations are properly configured",
                  risk_if_yes: "Over-reserved taxes",
                  risk_if_no: "Tax non-compliance",
                },
              ],
            });

          if (!approvalError) {
            approvalsCreated++;
          } else {
            console.error("Approval creation error:", approvalError);
          }
        }
      }
    }

    // Store review record
    const { error: reviewError } = await supabase
      .from("weekly_ceo_reviews")
      .insert({
        date: today,
        week_number: weekNumber,
        year: new Date().getFullYear(),
        reconciliation_items: reconciliationItems,
        approvals_created: approvalsCreated,
        completed_by: "System",
      });

    if (reviewError) {
      console.error("Review store error:", reviewError);
    }

    const review: WeeklyCEOReview = {
      date: today,
      week_number: weekNumber,
      reconciliation_items: reconciliationItems,
      approval_queue_created: approvalsCreated,
    };

    return new Response(
      JSON.stringify({
        success: true,
        review,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly CEO review error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
