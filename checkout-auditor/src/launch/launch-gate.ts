// Launch Gate — consolideert de bestaande auditor-observaties tot één PASS/WARNING/FAIL
// "kan dit product vandaag omzet ontvangen?"-oordeel over de VOLLEDIGE keten:
// checkout → coupon → success/cancel → webhook → membership-activatie → dashboard → e-mail → analytics.
//
// Additief: dit bestand wijzigt geen bestaande auditor-code. Het CONSUMEERT de outputs van
// driveStripeCheckout / observeStripe / observeWebhooks / observeDatabaseSync (zie recon),
// zodat de bestaande runner dit als laatste stap kan aanroepen voor een launch-readiness-verdict.

export type GateVerdict = "PASS" | "WARNING" | "FAIL";

/** Subset van de bestaande observatie-outputs die we nodig hebben (zie verification/*.ts). */
export interface GateInputs {
  product: string;
  tier?: string;
  country: string;
  checkout: {
    reached_stripe: boolean;
    session_id_from_url: string | null;
    paid_button_clicked: boolean;
    final_redirect_url: string | null;
    errors: string[];
  };
  /** success_url / cancel_url verwachtingen */
  urls: { success_url_ok: boolean; cancel_url_preserves_state: boolean };
  /** 100% coupon-flow: korting toegepast en geobserveerd? */
  coupon: { applied: boolean; discount_observed: boolean; coupon_used_event: boolean };
  webhook: {
    expected_events_missing: string[];
    max_latency_ms: number | null;
  };
  membership: {
    user_membership_row_exists: boolean;
    user_membership_status: string | null;
    discrepancies: string[];
  };
  dashboardAccessGranted: boolean;
  emailSent: boolean;
  analyticsEvents: string[]; // event_types seen in checkout_events
}

export interface GateCheck {
  key: string;
  verdict: GateVerdict;
  detail: string;
}

export interface GateResult {
  product: string;
  country: string;
  verdict: GateVerdict;
  checks: GateCheck[];
  blockers: string[];
}

const WEBHOOK_WARN_MS = 10_000;
const WEBHOOK_FAIL_MS = 30_000;

function worst(verdicts: GateVerdict[]): GateVerdict {
  if (verdicts.includes("FAIL")) return "FAIL";
  if (verdicts.includes("WARNING")) return "WARNING";
  return "PASS";
}

export function evaluateLaunchGate(i: GateInputs): GateResult {
  const checks: GateCheck[] = [];

  checks.push(
    i.checkout.reached_stripe && i.checkout.session_id_from_url
      ? { key: "checkout_reaches_stripe", verdict: "PASS", detail: "Stripe checkout bereikt met sessie-id." }
      : { key: "checkout_reaches_stripe", verdict: "FAIL", detail: `Checkout bereikt Stripe niet. ${i.checkout.errors.join("; ")}` },
  );

  checks.push(
    i.checkout.paid_button_clicked && i.checkout.final_redirect_url
      ? { key: "payment_completes", verdict: "PASS", detail: "Betaling afgerond + redirect ontvangen." }
      : { key: "payment_completes", verdict: "FAIL", detail: "Betaling niet afgerond of geen redirect." },
  );

  checks.push(
    i.urls.success_url_ok
      ? { key: "success_url", verdict: "PASS", detail: "success_url redirect correct." }
      : { key: "success_url", verdict: "WARNING", detail: "success_url niet bevestigd." },
  );
  checks.push(
    i.urls.cancel_url_preserves_state
      ? { key: "cancel_url", verdict: "PASS", detail: "cancel_url behoudt product/deal/submission." }
      : { key: "cancel_url", verdict: "WARNING", detail: "cancel_url verliest state." },
  );

  // 100% coupon flow
  if (i.coupon.applied) {
    const couponOk = i.coupon.discount_observed && i.coupon.coupon_used_event;
    checks.push(
      couponOk
        ? { key: "coupon_flow", verdict: "PASS", detail: "Coupon toegepast, korting + coupon_used event geobserveerd." }
        : {
            key: "coupon_flow",
            verdict: "FAIL",
            detail: `Coupon-flow incompleet (korting:${i.coupon.discount_observed}, event:${i.coupon.coupon_used_event}).`,
          },
    );
  }

  // Webhook delivery
  if (i.webhook.expected_events_missing.length > 0) {
    checks.push({
      key: "webhook_delivery",
      verdict: "FAIL",
      detail: `Ontbrekende webhook-events: ${i.webhook.expected_events_missing.join(", ")}.`,
    });
  } else if ((i.webhook.max_latency_ms ?? 0) > WEBHOOK_FAIL_MS) {
    checks.push({ key: "webhook_delivery", verdict: "FAIL", detail: `Webhook-latency ${i.webhook.max_latency_ms}ms > ${WEBHOOK_FAIL_MS}ms.` });
  } else if ((i.webhook.max_latency_ms ?? 0) > WEBHOOK_WARN_MS) {
    checks.push({ key: "webhook_delivery", verdict: "WARNING", detail: `Webhook-latency ${i.webhook.max_latency_ms}ms > ${WEBHOOK_WARN_MS}ms.` });
  } else {
    checks.push({ key: "webhook_delivery", verdict: "PASS", detail: "Alle verwachte webhook-events op tijd." });
  }

  // Membership activation
  const memberActive = i.membership.user_membership_row_exists && ["active", "trialing"].includes(i.membership.user_membership_status ?? "");
  checks.push(
    memberActive
      ? { key: "membership_activation", verdict: "PASS", detail: `Membership ${i.membership.user_membership_status}.` }
      : {
          key: "membership_activation",
          verdict: "FAIL",
          detail: `Geen actieve membership-rij. ${i.membership.discrepancies.join("; ")}`,
        },
  );

  // Dashboard access — kritiek als betaald maar geen toegang
  checks.push(
    i.dashboardAccessGranted
      ? { key: "dashboard_access", verdict: "PASS", detail: "Dashboard-toegang verleend." }
      : { key: "dashboard_access", verdict: memberActive ? "FAIL" : "WARNING", detail: "Dashboard-toegang niet verleend ondanks betaling." },
  );

  // Email
  checks.push(
    i.emailSent
      ? { key: "email_flow", verdict: "PASS", detail: "Bevestigings-/welkomstmail verzonden." }
      : { key: "email_flow", verdict: "WARNING", detail: "Geen e-mail bevestigd (Resend?)." },
  );

  // Analytics — verwacht minstens checkout_completed
  checks.push(
    i.analyticsEvents.includes("checkout_completed")
      ? { key: "analytics_event", verdict: "PASS", detail: `Analytics events: ${i.analyticsEvents.join(", ")}.` }
      : { key: "analytics_event", verdict: "WARNING", detail: "checkout_completed event ontbreekt." },
  );

  const verdict = worst(checks.map((c) => c.verdict));
  const blockers = checks.filter((c) => c.verdict === "FAIL").map((c) => `${c.key}: ${c.detail}`);

  return { product: i.product, country: i.country, verdict, checks, blockers };
}

/**
 * Best-effort mapping van een scenario + zijn observaties naar GateInputs.
 * Observatie-shapes verschillen per auditor-versie; daarom defensief (optional chaining),
 * en `null` als er te weinig signaal is (gate wordt dan overgeslagen, nooit een crash).
 */
export function mapObservationsToGate(scenario: any, observations: any): GateInputs | null {
  if (!observations) return null;
  const o = observations;
  const checkout = o.checkout ?? o.checkoutResult ?? o.stripe_checkout ?? o.driver ?? {};
  const stripe = o.stripe ?? o.stripeObservation ?? {};
  const webhooks = o.webhooks ?? o.webhookObservation ?? {};
  const db = o.database ?? o.databaseObservation ?? o.db ?? {};
  const events: string[] =
    (o.analytics_events as string[]) ??
    (Array.isArray(o.checkout_events) ? o.checkout_events.map((e: any) => e.event_type) : []) ??
    [];

  const product = scenario?.product_slug ?? scenario?.product ?? scenario?.tier_code ?? "unknown";
  const country = scenario?.country_code ?? "NL";

  // Geen enkele checkout-observatie → niets zinnigs te oordelen.
  if (checkout.reached_stripe === undefined && stripe.session === undefined) return null;

  return {
    product: String(product),
    tier: scenario?.tier_code,
    country: String(country),
    checkout: {
      reached_stripe: !!checkout.reached_stripe,
      session_id_from_url: checkout.session_id_from_url ?? stripe?.session?.id ?? null,
      paid_button_clicked: !!checkout.paid_button_clicked,
      final_redirect_url: checkout.final_redirect_url ?? null,
      errors: checkout.errors ?? [],
    },
    urls: {
      success_url_ok: !!(checkout.final_redirect_url && /success|checkout\/success/.test(String(checkout.final_redirect_url))),
      cancel_url_preserves_state: o.cancel_url_preserves_state ?? true,
    },
    coupon: {
      applied: !!(o.coupon?.applied ?? scenario?.coupon_applied),
      discount_observed: !!(o.coupon?.discount_observed ?? (stripe?.session?.amount_total < stripe?.session?.amount_subtotal)),
      coupon_used_event: events.includes("coupon_used"),
    },
    webhook: {
      expected_events_missing: webhooks.expected_events_missing ?? [],
      max_latency_ms: webhooks.max_latency_ms ?? null,
    },
    membership: {
      user_membership_row_exists: !!db.user_membership_row_exists,
      user_membership_status: db.user_membership_status ?? null,
      discrepancies: db.discrepancies ?? [],
    },
    dashboardAccessGranted: !!(o.dashboard_access_granted ?? db.user_membership_status === "active"),
    emailSent: !!(o.email_sent ?? o.emailSent),
    analyticsEvents: events,
  };
}

/** Render een compacte launch-gate samenvatting (voor het auditor-rapport). */
export function renderLaunchGate(results: GateResult[]): string {
  const icon = (v: GateVerdict) => (v === "PASS" ? "🟢" : v === "WARNING" ? "🟡" : "🔴");
  const lines = results.map((r) => {
    const head = `${icon(r.verdict)} ${r.product} (${r.country}) — ${r.verdict}`;
    const fails = r.blockers.length ? "\n   " + r.blockers.map((b) => `✗ ${b}`).join("\n   ") : "";
    return head + fails;
  });
  const overall = worst(results.map((r) => r.verdict));
  return `# Launch Gate — ${icon(overall)} ${overall}\n\n${lines.join("\n")}\n`;
}
