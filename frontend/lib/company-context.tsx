'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '@/types'
import { COMPANIES } from '@/lib/companies'

const STORAGE_KEY = 'orlando_active_company'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 jaar

function writeCookie(value: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

type CompanyContextValue = {
  activeCompany: Company
  setActiveCompany: (company: Company) => void
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [activeCompany, setActiveCompanyState] = useState<Company>(COMPANIES[0])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const found = COMPANIES.find((c) => c.id === stored)
      if (found) {
        setActiveCompanyState(found)
        writeCookie(found.id) // sync cookie zodat server-side ook synced is
        return
      }
    }
    // Fallback: schrijf default zodat server-side niet leeg leest
    writeCookie(COMPANIES[0].id)
  }, [])

  function setActiveCompany(company: Company) {
    localStorage.setItem(STORAGE_KEY, company.id)
    writeCookie(company.id)
    setActiveCompanyState(company)
    // Trigger RSC refetch — server components lezen de nieuwe cookie
    router.refresh()
  }

  return (
    <CompanyContext.Provider value={{ activeCompany, setActiveCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider')
  return ctx
}
