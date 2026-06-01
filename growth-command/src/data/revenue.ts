// READ-ONLY revenue + lead snapshot for the Hermes Launch Command tracker.
// No writes. Every query is a .select() / count.
import { supabasePublic, supabaseVastgoedCore } from "../lib/supabase.js";
import { startOfTodayUTC } from "../lib/format.js";

export interface RevenueSnapshot {
  ts: string;
  memberships: { total: number; active: number; newToday: number };
  reportPurchases: { total: number; revenueEur: number; today: number };
  checkout: { events: number; eventsToday: number };
  affiliate: { conversions: number; commissionEur: number };
  leads: { newsletter: number; financing: number; financingToday: number };
  revenueTodayEur: number;
  revenueCumulativeEur: number;
}

async function safeCount(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    console.error("[revenue] query failed:", (err as Error).message);
    return 0;
  }
}

async function countRows(client: ReturnType<typeof supabaseVastgoedCore>, table: string, since?: string): Promise<number> {
  let q = client.from(table).select("*", { count: "exact", head: true });
  if (since) q = q.gte("created_at", since);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function sumColumn(
  client: ReturnType<typeof supabaseVastgoedCore>,
  table: string,
  column: string,
  filterCol?: string,
  filterVal?: string,
): Promise<number> {
  let q = client.from(table).select(column);
  if (filterCol && filterVal) q = q.eq(filterCol, filterVal);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return rows.reduce((acc, row) => acc + Number(row[column] ?? 0), 0);
}

export async function getRevenueSnapshot(): Promise<RevenueSnapshot> {
  const vc = supabaseVastgoedCore();
  const pub = supabasePublic();
  const since = startOfTodayUTC();

  const [
    membershipsTotal,
    membershipsActive,
    membershipsToday,
    reportTotal,
    reportToday,
    reportRevenue,
    checkoutTotal,
    checkoutToday,
    affiliateConversions,
    affiliateCommission,
    newsletter,
    financing,
    financingToday,
  ] = await Promise.all([
    safeCount(() => countRows(vc, "user_memberships")),
    safeCount(async () => {
      const { count, error } = await vc
        .from("user_memberships")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    }),
    safeCount(() => countRows(vc, "user_memberships", since)),
    safeCount(() => countRows(vc, "user_report_purchases")),
    safeCount(async () => {
      const { count, error } = await vc
        .from("user_report_purchases")
        .select("*", { count: "exact", head: true })
        .gte("purchased_at", since);
      if (error) throw error;
      return count ?? 0;
    }),
    safeCount(() => sumColumn(vc, "user_report_purchases", "amount_eur", "status", "paid")),
    safeCount(() => countRows(vc, "checkout_events")),
    safeCount(() => countRows(vc, "checkout_events", since)),
    safeCount(() => countRows(pub, "affiliate_conversions")),
    safeCount(() => sumColumn(pub, "affiliate_revenue_ledger", "amount_eur")),
    safeCount(() => countRows(vc, "newsletter_leads")),
    safeCount(() => countRows(vc, "financing_leads")),
    safeCount(() => countRows(vc, "financing_leads", since)),
  ]);

  // Recurring revenue today is approximated by new memberships * avg ARPU is intentionally
  // NOT invented here — we report HARD facts: report revenue + affiliate commission realised.
  const revenueCumulativeEur = reportRevenue + affiliateCommission;
  // "today" hard revenue = report purchases today (amount unknown per-row here) + new memberships flagged.
  const revenueTodayEur = 0; // placeholder until a paid transaction lands; tracker flags this explicitly.

  return {
    ts: new Date().toISOString(),
    memberships: { total: membershipsTotal, active: membershipsActive, newToday: membershipsToday },
    reportPurchases: { total: reportTotal, revenueEur: reportRevenue, today: reportToday },
    checkout: { events: checkoutTotal, eventsToday: checkoutToday },
    affiliate: { conversions: affiliateConversions, commissionEur: affiliateCommission },
    leads: { newsletter, financing, financingToday },
    revenueTodayEur,
    revenueCumulativeEur,
  };
}
