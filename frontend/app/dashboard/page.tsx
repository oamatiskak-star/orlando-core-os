import { getActiveCompany } from '@/lib/active-company-server'
import DashboardOsm from '@/components/dashboard/landing/DashboardOsm'
import EntityLanding from '@/components/dashboard/landing/EntityLanding'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TAGLINES: Record<string, string> = {
  osm:               'Eigenaar overzicht — cross-entity intelligence & control',
  modiwerijo:        'Financiële holding — cashflow, payroll & compliance',
  'modiwe-media':    'Media + content — YouTube netwerk, social, monetization',
  'modiwe-software': 'Aquier + scrapers + SaaS tools — software werkmaatschappij',
  strkbeheer:        'Vastgoed deals + acquisitie — beheer holding',
  strkbouw:          'Bouwbedrijf — calculaties, bouwplaats, kopers',
  bouwproffs:        'Calculatiebureau — STABU + offerteflow',
}

export default async function DashboardPage() {
  const company = await getActiveCompany()

  if (company.id === 'osm') {
    return <DashboardOsm />
  }

  const tagline = TAGLINES[company.id] ?? `${company.name} dashboard`
  return <EntityLanding company={company} tagline={tagline} />
}
