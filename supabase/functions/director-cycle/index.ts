// director-cycle — Hermes Directeur-lus Fase 0 (media/MODIWE).
// ?phase=plan  : leest media-status (SQL) → Claude maakt dagplan → dispatcht autonome taken
//                naar orchestrator_tasks (executor='director'); onomkeerbaar/duur → Telegram-approval.
// ?phase=verify: leest het plan van vandaag + huidige status → meet uitvoering + pipeline-delta →
//                schrijft verify_result + stuurt één avondrapport (geen LLM).
// Auth: header x-cron-key === hermes_config 'director_cron_key'. Gate: engine_window_open (tenzij ?force=1).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

// task_types die ALTIJD goedkeuring vereisen (onomkeerbaar/duur), ongeacht LLM-label.
const DENY = /(publish|upload|live|delete|remove|drop|truncate|deploy|spend|pay|budget|\bad(s)?\b|promo|bulk|mutate|scraper|restart|channel_config|external)/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function slug(s: string) { return (s || "taak").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40); }

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const phase = url.searchParams.get("phase") ?? "plan";
  const force = url.searchParams.get("force") === "1";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Auth ──
  const { data: cfg } = await sb.from("hermes_config").select("value").eq("key", "director_cron_key").maybeSingle();
  if (!cfg?.value || req.headers.get("x-cron-key") !== cfg.value) return json({ error: "unauthorized" }, 401);

  // ── Engine-Planner gate ──
  if (!force) {
    const { data: open } = await sb.rpc("engine_window_open", { p_engine_key: `media:director-${phase}` });
    if (open !== true) return json({ skipped: `venster dicht: media:director-${phase}` });
  }

  const triggered_by = force ? "manual" : "cron";
  try {
    if (phase === "plan") return await runPlan(sb, triggered_by);
    if (phase === "verify") return await runVerify(sb, triggered_by);
    return json({ error: "bad phase" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function getTelegram(sb: any): Promise<{ token: string | null; chat: string | null }> {
  const { data } = await sb.from("hermes_config").select("key,value").in("key", ["telegram_bot_token", "telegram_chat_id"]);
  const m: Record<string, string> = {};
  for (const r of data ?? []) m[r.key] = r.value;
  return { token: m["telegram_bot_token"] ?? null, chat: m["telegram_chat_id"] ?? null };
}
async function tg(sb: any, text: string) {
  const { token, chat } = await getTelegram(sb);
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

// ───────────────────────────── PLAN ─────────────────────────────
async function runPlan(sb: any, triggered_by: string) {
  const { data: snapshot } = await sb.rpc("director_media_snapshot");

  // Fail-soft: zonder werkende key wél de cyclus + snapshot vastleggen (geen crash).
  if (!ANTHROPIC_KEY) {
    const { data: row } = await sb.from("director_cycles").insert({
      phase: "plan", triggered_by, status_snapshot: snapshot, llm_status: "no_key",
      summary: "Geen ANTHROPIC_API_KEY — alleen status vastgelegd.",
    }).select("id").single();
    await tg(sb, "⚠️ <b>Directeur</b>: kon geen plan maken (Anthropic-key ontbreekt). Status wel vastgelegd.");
    return json({ ok: true, llm_status: "no_key", cycle_id: row?.id });
  }

  const system = directorSystemPrompt();
  const userMsg = `Media-status van vandaag (JSON):\n${JSON.stringify(snapshot)}\n\nMaak het dagplan. Geef UITSLUITEND geldige JSON volgens het contract.`;

  let plan: any; let llm_status = "ok";
  try {
    const raw = await callClaude(system, userMsg);
    plan = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch (e) {
    const { data: row } = await sb.from("director_cycles").insert({
      phase: "plan", triggered_by, status_snapshot: snapshot, llm_status: "error",
      summary: "LLM-fout: " + String(e).slice(0, 200),
    }).select("id").single();
    await tg(sb, "⚠️ <b>Directeur</b>: planfase kon geen geldig plan genereren (LLM-fout). Status vastgelegd.");
    return json({ ok: false, llm_status: "error", error: String(e), cycle_id: row?.id });
  }

  const items: any[] = Array.isArray(plan.execution_plan) ? plan.execution_plan : [];
  const dispatched: string[] = [];
  let approvals = 0;
  const { chat } = await getTelegram(sb);
  const today = new Date().toISOString().slice(0, 10);

  for (const it of items) {
    const tt = String(it.task_type ?? "");
    // Guardrail: server-side denylist wint van LLM-label.
    const isApproval = it.type === "APPROVAL" || DENY.test(tt) || DENY.test(String(it.title ?? ""));
    if (!isApproval && dispatched.length < 3) {
      const { data: t } = await sb.from("orchestrator_tasks").insert({
        company_id: "modiwe",
        title: String(it.title ?? "Directeur-taak").slice(0, 200),
        task_type: tt || "media_task",
        executor: "director",
        objective: Array.isArray(it.objective) ? it.objective : [String(it.objective ?? it.title ?? "")],
        priority: Number(it.priority) || 5,
        payload: { source: "director-cycle", cycle_date: today },
      }).select("id").single();
      if (t?.id) dispatched.push(t.id);
    } else {
      approvals++;
      const opts = Array.isArray(it.approval_options) && it.approval_options.length ? it.approval_options : ["Ja, doe het", "Nee", "Later"];
      await sb.rpc("hermes_emit_action_prompt", {
        p_dedup: `director:${today}:${slug(it.title ?? tt)}`,
        p_chat: chat,
        p_question: `🤖 <b>Directeur vraagt</b>: ${it.approval_question ?? it.title ?? tt}`,
        p_options: opts,
      }).catch(() => {});
    }
  }

  const { data: row } = await sb.from("director_cycles").insert({
    phase: "plan", triggered_by, status_snapshot: snapshot, llm_status,
    summary: plan.summary ?? null,
    critical_alerts: plan.critical_alerts ?? [],
    blockers: plan.blockers ?? [],
    execution_plan: items,
    orlando_personal_tasks: plan.orlando_personal_tasks ?? [],
    autonomous_dispatched: dispatched.length,
    approval_queued: approvals,
    dispatched_task_ids: dispatched,
  }).select("id").single();

  return json({ ok: true, llm_status, cycle_id: row?.id, dispatched: dispatched.length, approvals });
}

// ──────────────────────────── VERIFY ────────────────────────────
async function runVerify(sb: any, triggered_by: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: planRow } = await sb.from("director_cycles")
    .select("*").eq("cycle_date", today).eq("phase", "plan")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (!planRow) {
    await tg(sb, "🌙 <b>Directeur-avond</b>: geen ochtendplan gevonden vandaag — niets te verifiëren.");
    return json({ ok: true, note: "no plan today" });
  }

  // 1) Taakuitvoering
  const ids: string[] = planRow.dispatched_task_ids ?? [];
  let done = 0, failed = 0, busy = 0;
  if (ids.length) {
    const { data: tasks } = await sb.from("orchestrator_tasks").select("id,status,result_summary").in("id", ids);
    for (const t of tasks ?? []) {
      if (t.status === "completed" && t.result_summary) done++;
      else if (t.status === "failed") failed++;
      else busy++;
    }
  }

  // 2) Pipeline-delta (echte outcome) vs ochtend-snapshot
  const { data: now } = await sb.rpc("director_media_snapshot");
  const before = planRow.status_snapshot ?? {};
  const dLive = (now?.uploads?.verified_live ?? 0) - (before?.uploads?.verified_live ?? 0);
  const dQueued = (now?.uploads?.queued ?? 0) - (before?.uploads?.queued ?? 0);
  const dFailed = (now?.uploads?.failed ?? 0) - (before?.uploads?.failed ?? 0);
  const dPlanned = (now?.calendar_planned ?? 0) - (before?.calendar_planned ?? 0);
  const dAlertsCrit = (now?.alerts?.critical ?? 0) - (before?.alerts?.critical ?? 0);

  // 3) Approvals opvolging
  const { count: openApprovals } = await sb.schema("hermes").from("action_prompts")
    .select("*", { count: "exact", head: true }).eq("status", "open").like("dedup_key", "director:%");

  const verify_result = {
    tasks: { dispatched: ids.length, done, failed, busy },
    pipeline_delta: { live: dLive, queued: dQueued, failed: dFailed, planned: dPlanned, alerts_critical: dAlertsCrit },
    open_director_approvals: openApprovals ?? 0,
  };

  // Bijsturen: taken 'completed' maar geen pipeline-beweging = mogelijk schijnwerk → blocker.
  const schijnwerk = done > 0 && dLive <= 0 && dPlanned <= 0;

  const { data: row } = await sb.from("director_cycles").insert({
    phase: "verify", triggered_by, status_snapshot: now, verify_result,
    summary: `Verificatie ${today}: ${done}/${ids.length} taken echt voltooid, Δlive=${dLive}, Δqueued=${dQueued}.`,
    blockers: schijnwerk ? [{ title: "Taken voltooid maar pipeline bewoog niet", why: "Mogelijk schijnwerk; output verifiëren." }] : [],
  }).select("id").single();

  const msg = `🌙 <b>Directeur — avondrapport (media)</b>\n\n`
    + `✅ Taken: <b>${done}/${ids.length}</b> echt voltooid${failed ? ` · ${failed} mislukt` : ""}${busy ? ` · ${busy} bezig` : ""}\n`
    + `📺 Live vandaag: <b>${dLive >= 0 ? "+" : ""}${dLive}</b> · wachtrij ${dQueued >= 0 ? "+" : ""}${dQueued} · gepland ${dPlanned >= 0 ? "+" : ""}${dPlanned}\n`
    + `❓ Open directeur-vragen: <b>${openApprovals ?? 0}</b>\n`
    + (schijnwerk ? `\n⚠️ <i>Let op: taken voltooid maar pipeline bewoog niet — mogelijk schijnwerk.</i>` : "");
  await tg(sb, msg);

  return json({ ok: true, cycle_id: row?.id, verify_result });
}

// ──────────────────────────── Claude ────────────────────────────
function directorSystemPrompt(): string {
  return `Je bent ORLAND-O — de AI-Directeur (CEO + Projectleider) van Orlando's MEDIA-fabriek (MODIWE BV: het YouTube-automatiseringsnetwerk). Je handelt in Orlando's naam.

Doel van de media-fabriek: gezonde, groeiende kanalen via consistente, analyse-gestuurde content; YPP-monetisatie; geen handwerk.

Je krijgt een status-snapshot (uploads-pijplijn, OAuth, alarmen, kanalen + prestatie, content-radar, content-recency). Bepaal de 3-7 belangrijkste acties van vandaag voor ALLEEN de media-fabriek.

GUARDRAIL (cruciaal — bijna-vol autonomie):
- type="AUTONOMOUS" mag ALLEEN voor REVERSIBELE media-acties: content plannen/herordenen (yt_content_calendar), prioriteren/triage van de upload-wachtrij (labelen, NIET verwijderen), content-radar-ideeën scoren, marketing-aanbevelingen genereren (recommend-only), analyses/rapporten schrijven. Max 3 AUTONOMOUS per dag.
- type="APPROVAL" voor alles ONOMKEERBAAR of DUUR: live publiceren/uploaden, uitgaven/ads, bulk-mutaties of verwijderen van uploads, kanaal-config wijzigen, scrapers herstarten/deployen, externe partijen. Geef dan een korte 'approval_question' (NL) + 'approval_options' (2-3 korte keuzes).

Let op de echte pijn in de data (bv. enorme upload-wachtrij, content al weken stil, onderpresterende kanalen) en maak daar concrete, kleine, uitvoerbare taken van — geen vaagheid.

Antwoord UITSLUITEND met geldige JSON:
{
 "summary": "1-2 zinnen NL",
 "critical_alerts": ["..."],
 "blockers": [{"title":"...","why":"..."}],
 "orlando_personal_tasks": [{"title":"...","reason":"...","urgency":"today|this_week"}],
 "execution_plan": [
   {"title":"...","task_type":"plan_content|triage_queue|score_radar|marketing_reco|analyse|publish|spend|...",
    "objective":["concrete stap 1","stap 2"],"priority":1-10,
    "type":"AUTONOMOUS|APPROVAL","approval_question":"(alleen bij APPROVAL)","approval_options":["...","..."]}
 ]
}`;
}

async function callClaude(system: string, user: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: 4096, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json() as any;
  const c = d.content?.[0];
  if (!c || c.type !== "text") throw new Error("onverwacht Claude-antwoord");
  return c.text as string;
}
