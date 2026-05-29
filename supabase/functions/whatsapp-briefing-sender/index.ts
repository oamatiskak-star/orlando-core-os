import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BriefingPayload {
  summary: string;
  per_entity: Array<{
    entity: string;
    orlando_tasks: string[];
    ai_ceo_tasks: string[];
    approvals_pending: string[];
  }>;
  critical_alerts: string[];
  this_week_top3: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as BriefingPayload;

    // Validate required WhatsApp configuration
    const whatsappToken = Deno.env.get("WHATSAPP_CLOUD_API_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const recipientPhone = Deno.env.get("ORLANDO_WHATSAPP_PHONE");

    if (!whatsappToken || !phoneNumberId || !recipientPhone) {
      console.warn("WhatsApp configuration incomplete, skipping briefing delivery");
      return new Response(
        JSON.stringify({
          success: false,
          message: "WhatsApp not configured",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format briefing for WhatsApp
    const briefingText = formatBriefingForWhatsApp(body);

    // Send via WhatsApp Cloud API
    const sendResult = await sendWhatsAppMessage(
      phoneNumberId,
      recipientPhone,
      briefingText,
      whatsappToken
    );

    if (!sendResult.ok) {
      console.error("WhatsApp send error:", sendResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: sendResult.error,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendResult.messageId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("WhatsApp briefing sender error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatBriefingForWhatsApp(briefing: BriefingPayload): string {
  const lines: string[] = [];

  // Summary
  lines.push(`*Goedemorgen Orlando* 🌅`);
  lines.push("");
  lines.push(briefing.summary);
  lines.push("");

  // Per entity updates
  if (briefing.per_entity && briefing.per_entity.length > 0) {
    lines.push("*📊 Team Updates*");
    for (const entity of briefing.per_entity) {
      lines.push("");
      lines.push(`*${entity.entity}*`);

      if (entity.orlando_tasks && entity.orlando_tasks.length > 0) {
        lines.push("  JIJ VANDAAG:");
        for (const task of entity.orlando_tasks) {
          lines.push(`    • ${task}`);
        }
      }

      if (entity.ai_ceo_tasks && entity.ai_ceo_tasks.length > 0) {
        lines.push("  AI CEO VANDAAG:");
        for (const task of entity.ai_ceo_tasks) {
          lines.push(`    • ${task}`);
        }
      }

      if (entity.approvals_pending && entity.approvals_pending.length > 0) {
        lines.push("  WACHT OP JOU:");
        for (const approval of entity.approvals_pending) {
          lines.push(`    • ${approval}`);
        }
      }
    }
  }

  // Critical alerts
  if (briefing.critical_alerts && briefing.critical_alerts.length > 0) {
    lines.push("");
    lines.push("*🚨 KRITIEKE ALERTS*");
    for (const alert of briefing.critical_alerts) {
      lines.push(`  ⚠️  ${alert}`);
    }
  }

  // This week priorities
  if (briefing.this_week_top3 && briefing.this_week_top3.length > 0) {
    lines.push("");
    lines.push("*📅 DEZE WEEK: Top 3*");
    for (let i = 0; i < briefing.this_week_top3.length; i++) {
      lines.push(`  ${i + 1}. ${briefing.this_week_top3[i]}`);
    }
  }

  lines.push("");
  lines.push("_Gegenereerd door IRIS_");

  return lines.join("\n");
}

async function sendWhatsAppMessage(
  phoneNumberId: string,
  recipientPhone: string,
  message: string,
  accessToken: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: {
          body: message,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `WhatsApp API error ${response.status}: ${errorText}`,
      };
    }

    const data = (await response.json()) as { messages?: Array<{ id: string }> };
    const messageId = data.messages?.[0]?.id;

    if (!messageId) {
      return {
        ok: false,
        error: "No message ID in response",
      };
    }

    return {
      ok: true,
      messageId,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to send WhatsApp message: ${String(error)}`,
    };
  }
}
