import { Company } from '@/types'

export const COMPANIES: Company[] = [
  {
    id: 'osm',
    name: 'O.S.M. AMATISKAK',
    short: 'O.S.M.',
    role: 'persoon',
    color: '#a855f7',
    modules: [],
  },
  {
    id: 'modiwerijo',
    name: 'Modiwerijo Financial Management BV',
    short: 'MODIWÉ',
    role: 'holding',
    color: '#6366f1',
    modules: [],
  },
  {
    id: 'modiwe-media',
    name: 'Modiwe Media BV',
    short: 'MEDIA',
    role: 'werkmaatschappij',
    color: '#8b5cf6',
    modules: [],
  },
  {
    id: 'modiwe-software',
    name: 'Modiwe Software BV',
    short: 'SOFTWARE',
    role: 'werkmaatschappij',
    color: '#06b6d4',
    modules: [],
  },
  {
    id: 'strkbeheer',
    name: 'STRKBEHEER BV',
    short: 'BEHEER',
    role: 'holding',
    color: '#0ea5e9',
    modules: [],
  },
  {
    id: 'strkbouw',
    name: 'STRKBOUW BV',
    short: 'BOUW',
    role: 'werkmaatschappij',
    color: '#f59e0b',
    modules: [],
  },
  {
    id: 'bouwproffs',
    name: 'Bouwproffs BV',
    short: 'PROFFS',
    role: 'werkmaatschappij',
    color: '#10b981',
    modules: [],
  },
]

export function getCompany(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id)
}
