export function eur(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function bar(value: number, target: number, width = 24): string {
  const ratio = target <= 0 ? 0 : Math.max(0, Math.min(1, value / target));
  const filled = Math.round(ratio * width);
  return "[" + "█".repeat(filled) + "·".repeat(width - filled) + "] " + pct(ratio * 100);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfTodayUTC(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export type Verdict = "PASS" | "WARNING" | "FAIL";

export function verdictIcon(v: Verdict): string {
  return v === "PASS" ? "🟢" : v === "WARNING" ? "🟡" : "🔴";
}
