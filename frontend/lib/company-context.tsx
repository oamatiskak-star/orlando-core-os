'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Company } from '@/types'
import { COMPANIES } from '@/lib/companies'

const STORAGE_KEY = 'orlando_active_company'

type CompanyContextValue = {
  activeCompany: Company
  setActiveCompany: (company: Company) => void
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompany, setActiveCompanyState] = useState<Company>(COMPANIES[0])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const found = COMPANIES.find((c) => c.id === stored)
      if (found) setActiveCompanyState(found)
    }
  }, [])

  function setActiveCompany(company: Company) {
    localStorage.setItem(STORAGE_KEY, company.id)
    setActiveCompanyState(company)
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
