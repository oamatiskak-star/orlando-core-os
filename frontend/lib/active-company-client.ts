'use client'

import { COMPANIES, getCompany } from '@/lib/companies'
import { Company } from '@/types'

const COOKIE_KEY = 'orlando_active_company'

export function getActiveCompanyId(): string {
  if (typeof document === 'undefined') return COMPANIES[0].id
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_KEY}=`))
    ?.split('=')[1]

  if (cookieValue && COMPANIES.find((c) => c.id === cookieValue)) {
    return cookieValue
  }
  return COMPANIES[0].id
}

export function getActiveCompany(): Company {
  const id = getActiveCompanyId()
  return getCompany(id) ?? COMPANIES[0]
}
