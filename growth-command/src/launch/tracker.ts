// Hermes Launch Command — daily revenue/launch tracker (first 30 days).
// Reads production read-only, derives checkout status / leads / memberships / revenue / blockers,
// and renders a daily report with PASS/WARNING/FAIL + First €10K sprint progress.
import { getRevenueSnapshot, type RevenueSnapshot } from "../data/revenue.js";
import { bar, eur, todayISO, verdictIcon, type Verdict } from "../lib/format.js";

const SPRINT_TARGET = Number(process.env.FIRST_SPRINT_TARGET_EUR || 10000);

export interface Blocker {
  verdict: Verdict;
  label: string;
  detail: string;
}

function deriveBlockers(s: RevenueSnapshot): Blocker[] {
  const b: Blocker[] = [];

  // Payment path: checkout attempts but no conversions → funnel/link blocker.
  if (s.checkout.events > 0 && s.memberships.total === 0 && s.reportPurchases.total === 0) {
    b.push({
      verdict: "FAIL",
      label: "Checkout converteert niet",
      detail: `${s.checkout.events} checkout-events, 0 betaalde transacties → payment link activeren / funnel-bug auditen (zie checkout-auditor).`,
    });
  } else if (s.checkout.events === 0) {
    b.push({
      verdict: "WARNING",
      label: "Geen checkout-verkeer",
      detail: "Nog 0 checkout-events → eerste payment link delen (warm netwerk / Off-Market NL).",
    });
  }

  // Affiliate ready but dormant.
  if (s.affiliate.conversions === 0) {
    b.push({
      verdict: "WARNING",
      label: "Affiliate dormant",
      detail: "0 affiliate-conversies → 8 accounts live zetten + tracking-links delen.",
    });
  }

  // Lead instroom.
  if (s.leads.newsletter + s.leads.financing === 0) {
    b.push({
      verdict: "WARNING",
      label: "Geen leads",
      detail: "0 leads → lead-magnet (gratis deal-analyse) + financierings-intake live.",
    });
  }

  if (b.length === 0) b.push({ verdict: "PASS", label: "Geen blokkades gedetecteerd", detail: "Omzetkanalen lopen." });
  return b;
}

function overallVerdict(blockers: Blocker[]): Verdict {
  if (blockers.some((x) => x.verdict === "FAIL")) return "FAIL";
  if (blockers.some((x) => x.verdict === "WARNING")) return "WARNING";
  return "PASS";
}

export interface LaunchReport {
  date: string;
  snapshot: RevenueSnapshot;
  blockers: Blocker[];
  verdict: Verdict;
  markdown: string;
}

export async function buildLaunchReport(): Promise<LaunchReport> {
  const snapshot = await getRevenueSnapshot();
  const blockers = deriveBlockers(snapshot);
  const verdict = overallVerdict(blockers);
  const date = todayISO();

  const md = `# Hermes Launch Command — Daily Report ${date}

**Overall:** ${verdictIcon(verdict)} ${verdict}

## First €10K Sprint
${bar(snapshot.revenueCumulativeEur, SPRINT_TARGET)}  ${eur(snapshot.revenueCumulativeEur)} / ${eur(SPRINT_TARGET)}

## Omzet (harde feiten)
- Rapport-omzet (betaald): **${eur(snapshot.reportPurchases.revenueEur)}** (${snapshot.reportPurchases.total} verkopen, ${snapshot.reportPurchases.today} vandaag)
- Affiliate-commissie (grootboek): **${eur(snapshot.affiliate.commissionEur)}** (${snapshot.affiliate.conversions} conversies)
- Cumulatief hard gerealiseerd: **${eur(snapshot.revenueCumulativeEur)}**

## Memberships
- Totaal: ${snapshot.memberships.total} · Actief: ${snapshot.memberships.active} · Nieuw vandaag: ${snapshot.memberships.newToday}

## Checkout status
- Events totaal: ${snapshot.checkout.events} · vandaag: ${snapshot.checkout.eventsToday}

## Leads
- Newsletter: ${snapshot.leads.newsletter} · Financiering: ${snapshot.leads.financing} (vandaag ${snapshot.leads.financingToday})

## Blockers
${blockers.map((b) => `- ${verdictIcon(b.verdict)} **${b.label}** — ${b.detail}`).join("\n")}

---
_Read-only snapshot @ ${snapshot.ts}. Geen DB-write. Bron: vastgoed_core + public schema._
`;

  return { date, snapshot, blockers, verdict, markdown: md };
}
