import { ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { setBacklinkStatus, saveBacklinkPlacement, createBacklinkTarget } from '../backlink-actions';
import {
  BACKLINK_CATEGORY_LABEL, BACKLINK_STATUS_LABEL, BACKLINK_STATUS_OPTIONS, BACKLINK_CATEGORY_OPTIONS,
  type BacklinkTargetRow, type BacklinkOverviewRow,
} from '@/lib/backlinks/types';
import { BacklinkKitPanel } from './BacklinkKitPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SITE = 'aquier.com';
// Ratio-vloer: ~1 referring domain per 10 pagina's → ~280 pagina's ≈ 25-40. Fase 1 = 25.
const FLOOR_TARGET = 25;

const STATUS_COLOR: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  submitted: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  queued: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
  na: 'bg-white/[0.06] text-white/40 border-white/10',
  not_started: 'bg-white/[0.04] text-white/50 border-white/10',
};

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-3">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-lg font-semibold text-white/90 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-white/40">{sub}</div>}
    </div>
  );
}

export default async function BacklinksPage() {
  const supabase = await createClient();

  const { data: kpiData } = await supabase
    .from('v_backlink_overview').select('*').eq('site', SITE).maybeSingle();
  const kpi = (kpiData as BacklinkOverviewRow | null) ?? null;

  const { data } = await supabase
    .from('backlink_targets')
    .select('id, site, name, category, url, domain_rating, dofollow, cost, tier, submit_status, target_page, placement_url')
    .eq('site', SITE)
    .order('tier', { ascending: true })
    .order('domain_rating', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true });
  const targets: BacklinkTargetRow[] = (data ?? []) as BacklinkTargetRow[];

  const refDomains = kpi?.referring_domains_live ?? 0;
  const pct = Math.min(100, Math.round((refDomains / FLOOR_TARGET) * 100));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-white">Backlink Factory — {SITE}</h1>
        <p className="text-[11px] text-white/45 mt-0.5">
          Ratio-doel: tel referring <em>domeinen</em>, vloer ~1 per 10 pagina&apos;s. Fase 1 = {FLOOR_TARGET} domeinen → breekt de index-muur.
        </p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi label="Targets" value={kpi?.total_targets ?? targets.length} />
        <Kpi label="Live" value={kpi?.live ?? 0} />
        <Kpi label="In behandeling" value={kpi?.in_progress ?? 0} />
        <Kpi label="Todo" value={kpi?.todo ?? 0} />
        <Kpi label="Referring domains" value={`${refDomains}/${FLOOR_TARGET}`} sub={`${pct}% van vloer`} />
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full bg-emerald-400/70" style={{ width: `${pct}%` }} />
      </div>

      {/* Submission-kit (invul-klare copy) */}
      <BacklinkKitPanel />

      {/* Add */}
      <details className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <summary className="text-[11px] text-white/70 cursor-pointer select-none">+ Nieuw backlink-target toevoegen</summary>
        <form action={createBacklinkTarget} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
          <input name="name" required placeholder="Naam" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85 placeholder:text-white/30" />
          <select name="category" defaultValue="directory_saas" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85">
            {BACKLINK_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{BACKLINK_CATEGORY_LABEL[c]}</option>)}
          </select>
          <input name="url" placeholder="https://…" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85 placeholder:text-white/30" />
          <div className="flex gap-2">
            <input name="tier" type="number" min={1} max={3} defaultValue={2} title="Tier 1-3" className="w-16 bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
            <button type="submit" className="flex-1 px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200">Toevoegen</button>
          </div>
        </form>
      </details>

      {/* Registry */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4 overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
              <th className="pb-2 font-medium">T</th>
              <th className="pb-2 font-medium">Target</th>
              <th className="pb-2 font-medium">Categorie</th>
              <th className="pb-2 font-medium text-right">DR</th>
              <th className="pb-2 font-medium">Follow</th>
              <th className="pb-2 font-medium">Kosten</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Verkregen URL</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id} className="border-t border-white/[0.04] align-middle">
                <td className="py-2 pr-2">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${t.tier === 1 ? 'bg-amber-400/20 text-amber-300' : t.tier === 2 ? 'bg-white/[0.08] text-white/60' : 'bg-white/[0.04] text-white/40'}`}>{t.tier}</span>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-white/90 font-medium">{t.name}</span>
                    {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60"><ExternalLink size={11} /></a>}
                  </div>
                  {t.target_page && <div className="text-[9.5px] text-sky-300/60 font-mono">→ {t.target_page}</div>}
                </td>
                <td className="py-2 pr-3 text-[10px] text-white/55">{BACKLINK_CATEGORY_LABEL[t.category]}</td>
                <td className="py-2 pr-3 text-right text-[11px] tabular-nums text-white/70">{t.domain_rating ?? '—'}</td>
                <td className="py-2 pr-3 text-[11px]">{t.dofollow ? <span className="text-emerald-300">dofollow</span> : <span className="text-white/40">nofollow</span>}</td>
                <td className="py-2 pr-3 text-[10px] text-white/55">{t.cost}</td>
                <td className="py-2 pr-3">
                  <form action={setBacklinkStatus} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <select name="submit_status" defaultValue={t.submit_status} className={`border rounded px-1.5 py-1 text-[10px] ${STATUS_COLOR[t.submit_status] ?? STATUS_COLOR.not_started}`}>
                      {BACKLINK_STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-zinc-900 text-white">{BACKLINK_STATUS_LABEL[s]}</option>)}
                    </select>
                    <button type="submit" className="px-2 py-1 text-[10px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/75">Set</button>
                  </form>
                </td>
                <td className="py-2">
                  <form action={saveBacklinkPlacement} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="placement_url" defaultValue={t.placement_url ?? ''} placeholder="https://… (live link)" className="w-44 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10px] text-emerald-200/90 placeholder:text-white/25 font-mono" />
                    <button type="submit" className="px-2 py-1 text-[10px] bg-emerald-500/12 hover:bg-emerald-500/22 border border-emerald-400/25 rounded text-emerald-200">✓</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-white/30">
        Een verkregen link opslaan zet de status automatisch op <span className="font-mono text-white/50">live</span>. De
        &quot;Referring domains&quot;-teller telt unieke live hostnames — dat is de ratio-metric die telt (niet het aantal links).
      </p>
    </div>
  );
}
