import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as os from 'os'
import * as path from 'path'
import { fmpAvailable, getDailyCloses } from './financial-data-fetch'
import { renderLineChart } from './chart-generator'

// Chart-intelligence: genereert echte data-charts (FMP) en koppelt ze als scene-visual aan
// data-beat scenes van een finance data-explainer — i.p.v. generieke stock (de reden dat de
// huidige content 0 views haalt). Gegate: zonder FMP_API_KEY no-op (graceful). Raakt alleen
// het project waarvoor het wordt aangeroepen (finance-profiel).

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface ChartAttachResult { chartsAttached: number; reason: string | null }

export async function attachChartsToProject(
  projectId: string,
  format: '16:9' | '9:16' | '1:1',
  symbols: string[],
): Promise<ChartAttachResult> {
  if (!fmpAvailable()) return { chartsAttached: 0, reason: 'fmp_unavailable' }
  if (symbols.length === 0) return { chartsAttached: 0, reason: 'no_symbols' }

  const client = db()
  const { data: scenes } = await client
    .from('video_scenes')
    .select('id, idx')
    .eq('project_id', projectId)
    .order('idx')
  const list = scenes ?? []
  if (list.length < 2) return { chartsAttached: 0, reason: 'too_few_scenes' }

  const outDir = path.join(os.tmpdir(), `cf2-charts-${projectId}`)
  const w = format === '16:9' ? 1920 : 1080
  const h = format === '16:9' ? 1080 : 1920

  // Charts voor max 2 symbolen, gespreid over data-beat scenes (sla scene 0 = hook over).
  const chartSymbols = symbols.slice(0, 2)
  const beats = list.slice(1)
  const step = Math.max(1, Math.floor(beats.length / chartSymbols.length))
  const targetScenes = chartSymbols.map((_, i) => beats[Math.min(i * step, beats.length - 1)]).filter(Boolean)

  let attached = 0
  for (let i = 0; i < chartSymbols.length && i < targetScenes.length; i++) {
    const sym = chartSymbols[i]
    const closes = await getDailyCloses(sym, 60)
    if (closes.length < 5) continue

    const png = await renderLineChart(
      {
        title: `${sym} — last ${closes.length} sessions`,
        labels: closes.map((c) => c.date.slice(5)),
        series: [{ label: sym, data: closes.map((c) => c.close) }],
        width: w, height: h, darkTheme: true,
      },
      outDir,
      `chart-${sym.replace(/[^A-Za-z0-9]/g, '_')}.png`,
    )
    if (!png) continue

    const sc = targetScenes[i]
    const { data: ins } = await client
      .from('visual_assets')
      .insert({
        scene_id: sc.id,
        project_id: projectId,
        source_provider: 'chart-generator',
        local_asset_url: png,
        license: 'generated',
        license_status: 'cleared',
        final_visual_score: 90,
        approved_for_reuse: false,
        reuse_count: 0,
      })
      .select('id')
      .single()

    if (ins?.id) {
      await client.from('video_scenes').update({ selected_asset_id: ins.id }).eq('id', sc.id)
      attached++
    }
  }

  return { chartsAttached: attached, reason: attached ? null : 'no_charts_rendered' }
}
