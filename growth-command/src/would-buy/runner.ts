// Would Buy Runner — simulates per-product, per-persona buying decisions.
// Output: score, objections, buy-triggers, improvement advice per persona, aggregated per product.
import { askJson, hasAnthropic } from "../lib/anthropic.js";
import { PERSONAS, PRODUCTS, type Product } from "../catalog.js";

export interface PersonaVerdict {
  persona: string;
  personaName: string;
  score: number; // 0-100 likelihood to buy
  wouldBuy: boolean;
  objections: string[];
  buyTriggers: string[];
  improvementAdvice: string[];
  note?: string;
}

export interface ProductResult {
  product: string;
  productName: string;
  readiness: Product["readiness"];
  avgScore: number;
  verdicts: PersonaVerdict[];
  topObjections: string[];
  topAdvice: string[];
}

const SYSTEM = `Je bent een nuchtere Nederlandse vastgoed-koper die een SaaS/rapport-aanbod beoordeelt.
Je beslist eerlijk of je dit ZOU KOPEN. Geen marketing-optimisme. Geef concrete bezwaren en kooptriggers.
Antwoord-JSON-schema: {"score": <0-100 koopkans>, "wouldBuy": <bool>, "objections": [".."], "buyTriggers": [".."], "improvementAdvice": [".."]}`;

function buildUserPrompt(product: Product, personaKey: string): string {
  const p = PERSONAS[personaKey];
  return `PRODUCT: ${product.name}
PRIJS: ${product.priceLabel}
PITCH: ${product.pitch}
LAUNCH-STATUS: ${product.readiness}

JOUW PROFIEL (${p.name}): ${p.profile}
JOUW DRIJFVEREN: ${p.drivers.join(", ")}
JOUW SCEPSIS: ${p.skepticism}

Beoordeel als deze persoon of je dit product zou kopen. Wees concreet en kritisch.`;
}

function fallbackVerdict(product: Product, personaKey: string): PersonaVerdict {
  const p = PERSONAS[personaKey];
  // Deterministic heuristic so the runner works WITHOUT an API key.
  const base = product.readiness === "LAUNCH_READY" ? 55 : product.readiness === "MINOR_FIXES" ? 40 : 20;
  return {
    persona: personaKey,
    personaName: p.name,
    score: base,
    wouldBuy: base >= 50,
    objections: [p.skepticism],
    buyTriggers: product.kind === "membership" ? ["doorlopende deal-alerts", "tijd besparen"] : ["concreet GO/NO-GO bewijs"],
    improvementAdvice: ["Toon een echte (geanonimiseerde) voorbeeld-uitkomst met €/m²-rekensom als proof-of-value"],
    note: "fallback (geen ANTHROPIC_API_KEY) — heuristische schatting, geen LLM-simulatie",
  };
}

async function runPersona(product: Product, personaKey: string): Promise<PersonaVerdict> {
  if (!hasAnthropic()) return fallbackVerdict(product, personaKey);
  const parsed = await askJson<{
    score: number;
    wouldBuy: boolean;
    objections: string[];
    buyTriggers: string[];
    improvementAdvice: string[];
  }>(SYSTEM, buildUserPrompt(product, personaKey));
  if (!parsed) return { ...fallbackVerdict(product, personaKey), note: "LLM-call mislukt → fallback" };
  const p = PERSONAS[personaKey];
  return {
    persona: personaKey,
    personaName: p.name,
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    wouldBuy: !!parsed.wouldBuy,
    objections: parsed.objections ?? [],
    buyTriggers: parsed.buyTriggers ?? [],
    improvementAdvice: parsed.improvementAdvice ?? [],
  };
}

function topN(items: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

export async function runWouldBuy(productKeys?: string[]): Promise<ProductResult[]> {
  const products = productKeys?.length ? PRODUCTS.filter((p) => productKeys.includes(p.key)) : PRODUCTS;
  const results: ProductResult[] = [];
  for (const product of products) {
    const verdicts = await Promise.all(product.personas.map((pk) => runPersona(product, pk)));
    const avgScore = Math.round(verdicts.reduce((a, v) => a + v.score, 0) / Math.max(1, verdicts.length));
    results.push({
      product: product.key,
      productName: product.name,
      readiness: product.readiness,
      avgScore,
      verdicts,
      topObjections: topN(verdicts.flatMap((v) => v.objections), 3),
      topAdvice: topN(verdicts.flatMap((v) => v.improvementAdvice), 3),
    });
  }
  return results.sort((a, b) => b.avgScore - a.avgScore);
}
