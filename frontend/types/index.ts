export type Company = {
  id: string
  name: string
  short: string
  role: 'persoon' | 'holding' | 'werkmaatschappij'
  color: string
  modules: string[]
}

export type NavItem = {
  label: string
  href: string
  icon: string
  badge?: number
}

export type User = {
  id: string
  name: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'PROJECT_MANAGER' | 'ACCOUNTING' | 'CLIENT' | 'AGENT' | 'EXECUTOR'
  company_id: string
}
