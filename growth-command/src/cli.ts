#!/usr/bin/env tsx
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runWouldBuy } from "./would-buy/runner.js";
import { buildLaunchReport } from "./launch/tracker.js";
import { eur, verdictIcon, type Verdict } from "./lib/format.js";

const REPORT_DIR = process.env.GROWTH_COMMAND_REPORT_DIR || "./reports";

function readinessIcon(r: string): string {
  return r === "LAUNCH_READY" ? "🟢" : r === "MINOR_FIXES" ? "🟡" : "🔴";
}

async function cmdWouldBuy(args: string[]): Promise<void> {
  const keys = args.filter((a) => !a.startsWith("--"));
  const results = await runWouldBuy(keys.length ? keys : undefined);

  console.log("\n=== WOULD BUY RUNNER ===\n");
  for (const r of results) {
    console.log(`${readinessIcon(r.readiness)} ${r.productName}  —  gem. koopkans: ${r.avgScore}/100`);
    for (const v of r.verdicts) {
      console.log(`   • ${v.personaName}: ${v.score}/100 ${v.wouldBuy ? "✅ zou kopen" : "❌ nog niet"}${v.note ? `  (${v.note})` : ""}`);
      if (v.objections.length) console.log(`       bezwaren: ${v.objections.join(" | ")}`);
      if (v.buyTriggers.length) console.log(`       triggers: ${v.buyTriggers.join(" | ")}`);
    }
    if (r.topAdvice.length) console.log(`   → verbeteradvies: ${r.topAdvice.join(" | ")}`);
    console.log("");
  }

  if (args.includes("--save")) {
    mkdirSync(REPORT_DIR, { recursive: true });
    const path = join(REPORT_DIR, `would-buy-${new Date().toISOString().slice(0, 10)}.json`);
    writeFileSync(path, JSON.stringify(results, null, 2));
    console.log(`Saved → ${path}`);
  }
}

async function cmdLaunchTracker(args: string[]): Promise<void> {
  const report = await buildLaunchReport();
  console.log("\n" + report.markdown + "\n");

  if (args.includes("--save")) {
    mkdirSync(REPORT_DIR, { recursive: true });
    const path = join(REPORT_DIR, `launch-${report.date}.md`);
    writeFileSync(path, report.markdown);
    console.log(`Saved → ${path}`);
  }
  // Non-zero exit on FAIL so cron/CI can alert.
  if (report.verdict === ("FAIL" as Verdict)) process.exitCode = 2;
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "would-buy":
      await cmdWouldBuy(args);
      break;
    case "launch-tracker":
      await cmdLaunchTracker(args);
      break;
    default:
      console.log(`growth-command
Usage:
  tsx src/cli.ts would-buy [productKeys...] [--save]
  tsx src/cli.ts launch-tracker [--save]

Products: scout developer black deal_analyses vastgoedrapporten bouwcalculaties
          financierings_intake financierings_matching investeerders_matching affiliate

Verdict legend: ${verdictIcon("PASS")} PASS  ${verdictIcon("WARNING")} WARNING  ${verdictIcon("FAIL")} FAIL
Example: ${eur(10000)} sprint tracked by launch-tracker.`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
