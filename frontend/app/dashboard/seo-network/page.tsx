import { Globe, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Niche = { id: string; slug: string; naam: string; channel_link: string | null }
type Page = { niche_id: string; status: string }

const STATUS_COLOR: Record<string, string> = {
  planned:    'text-white/50',
  generating: 'text-blue-400',
  draft:      'text-amber-400',
  published:  'text-emerald-400',
  blocked:    'text-red-400',
}

export default async function SeoNetworkPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()

  const [{ data: nichesData }, { data: pagesData }] = await Promise.all([
    supabase.from('seo_niches').select('id, slug, naam, channel_link').order('slug'),
    supabase.from('seo_pages').select('niche_id, status'),
  ])

  const niches: Niche[] = (nichesData ?? []) as Niche[]
  const pages: Page[] = (pagesData ?? []) as Page[]

  const total = pages.length
  const byStatus = (s: string) => pages.filter((p) => p.status === s).length
  const countFor = (nicheId: string) => pages.filter((p) => p.niche_id === nicheId).length
  const publishedFor = (nicheId: string) =>
    pages.filter((p) => p.niche_id === nicheId && p.status === 'published').length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <Globe size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">SEO Network (M4)</h1>
          <p className="text-xs text-white/50">
            {niches.length} niches · {total} pagina's · {byStatus('published')} live · {byStatus('draft')} draft · {byStatus('planned')} gepland
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <Globe size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/40">Geen pagina's</p>
          <p className="text-[10px] text-white/25 mt-1">Draai seo-network/scaffolding.sql</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {niches.map((n) => {
            const cnt = countFor(n.id)
            const pub = publishedFor(n.id)
            const pct = cnt ? Math.round((pub / cnt) * 100) : 0
            return (
              <div key={n.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] text-white/90 font-medium">{n.naam}</p>
                  {n.channel_link && (
                    <span className="text-[10px] text-white/40">{n.channel_link}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${company.color}, ${company.color}cc)` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/55 w-16 text-right">{pub}/{cnt} live</span>
                </div>
                <p className="text-[10px] text-white/40 mt-2">/{n.slug}</p>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-white/30">
        Content key-gated: pagina's blijven gepland tot de generatie-worker draait (ANTHROPIC_API_KEY in runtime).
      </p>
    </div>
  )
}
