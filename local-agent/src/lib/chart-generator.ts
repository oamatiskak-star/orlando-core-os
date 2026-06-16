import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

// Chart-generator voor de finance data-explainer format-engine. Zet echte cijfers om in
// PNG-grafieken die als scene-visual dienen (i.p.v. generieke stock — dé reden dat de huidige
// content 0 views haalt). Gebruikt QuickChart (gratis hosted Chart.js render, geen API-key).
// Self-host kan later via QUICKCHART_BASE env. Graceful: gooit niet, geeft null bij fout.

const QUICKCHART_BASE = process.env.QUICKCHART_BASE ?? 'https://quickchart.io'

export interface LineChartSpec {
  title: string
  labels: string[]
  series: { label: string; data: number[] }[]
  width?: number
  height?: number
  darkTheme?: boolean
}

function chartConfig(spec: LineChartSpec): Record<string, unknown> {
  const palette = ['#16c784', '#ea3943', '#f0b90b', '#3861fb', '#9b59b6']
  return {
    type: 'line',
    data: {
      labels: spec.labels,
      datasets: spec.series.map((s, i) => ({
        label: s.label,
        data: s.data,
        borderColor: palette[i % palette.length],
        backgroundColor: 'transparent',
        borderWidth: 4,
        pointRadius: 0,
        tension: 0.25,
      })),
    },
    options: {
      plugins: {
        title: { display: true, text: spec.title, color: spec.darkTheme ? '#fff' : '#111', font: { size: 28, weight: 'bold' } },
        legend: { labels: { color: spec.darkTheme ? '#eee' : '#222', font: { size: 18 } } },
      },
      scales: {
        x: { ticks: { color: spec.darkTheme ? '#bbb' : '#444', font: { size: 14 } }, grid: { color: spec.darkTheme ? '#333' : '#ddd' } },
        y: { ticks: { color: spec.darkTheme ? '#bbb' : '#444', font: { size: 14 } }, grid: { color: spec.darkTheme ? '#333' : '#ddd' } },
      },
    },
  }
}

/**
 * Rendert een line-chart naar een PNG-bestand. Geeft het pad terug, of null bij fout.
 * outDir moet bestaan (of wordt aangemaakt).
 */
export async function renderLineChart(spec: LineChartSpec, outDir: string, fileName: string): Promise<string | null> {
  try {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, fileName.endsWith('.png') ? fileName : `${fileName}.png`)
    const res = await axios.post(
      `${QUICKCHART_BASE}/chart`,
      {
        width: spec.width ?? 1280,
        height: spec.height ?? 720,
        backgroundColor: spec.darkTheme ? '#0d1117' : '#ffffff',
        format: 'png',
        chart: chartConfig(spec),
      },
      { responseType: 'arraybuffer', timeout: 15000 },
    )
    fs.writeFileSync(outPath, Buffer.from(res.data))
    return outPath
  } catch {
    return null
  }
}
