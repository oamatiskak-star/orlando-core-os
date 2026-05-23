import { cookies } from 'next/headers'
import { COMPANIES, getCompany } from '@/lib/companies'
import { Company } from '@/types'

const COOKIE_KEY = 'orlando_active_company'

export async function getActiveCompanyId(): Promise<string> {
  const store = await cookies()
  const raw = store.get(COOKIE_KEY)?.value
  if (raw && COMPANIES.find((c) => c.id === raw)) return raw
  return COMPANIES[0].id
}

export async function getActiveCompany(): Promise<Company> {
  const id = await getActiveCompanyId()
  return getCompany(id) ?? COMPANIES[0]
}
