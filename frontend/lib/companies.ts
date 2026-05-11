import { Company } from '@/types'

export const COMPANIES: Company[] = [
  {
    id: 'modiwerijo',
    name: 'Modiwerijo Financial Management BV',
    short: 'MODIWÉ',
    role: 'holding',
    color: '#6366f1',
    modules: ['Core OS', 'AI Agents', 'Workflow Engine', 'YouTube Automation', 'Mail Automation', 'Administratie', 'Belasting'],
  },
  {
    id: 'modiwe-media',
    name: 'Modiwe Media BV',
    short: 'MEDIA',
    role: 'werkmaatschappij',
    color: '#8b5cf6',
    modules: ['YouTube Automation', 'Content Studio', 'Mail Automation', 'Analytics', 'CRM Marketing'],
  },
  {
    id: 'strkbeheer',
    name: 'STRKBEHEER BV',
    short: 'BEHEER',
    role: 'holding',
    color: '#0ea5e9',
    modules: ['VastgoedScalper', 'CRM', 'Finance', 'Projectontwikkeling', 'Dealflow', 'Investeerders', 'Asset Management'],
  },
  {
    id: 'strkbouw',
    name: 'STRKBOUW BV',
    short: 'BOUW',
    role: 'werkmaatschappij',
    color: '#f59e0b',
    modules: ['SterkCalc', 'BouwplaatsApp', 'Planning', 'Inkoop', 'Werkbonnen', 'Projecten'],
  },
  {
    id: 'bouwproffs',
    name: 'Bouwproffs BV',
    short: 'PROFFS',
    role: 'reserve',
    color: '#6b7280',
    modules: [],
  },
]

export function getCompany(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id)
}
