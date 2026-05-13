import {
  LayoutDashboard, Home, Building2, FolderKanban, TrendingUp,
  Calculator, Users, Banknote, Video, Bot, Workflow, Files,
  Calendar, Bell, Settings, Activity, CreditCard, CheckSquare,
  FileText, Layers, Zap, BarChart3, Package, Hammer,
  ClipboardList, ShoppingCart, Wrench, PlusCircle, ReceiptText,
  Wallet, Scale, BookOpen, LucideIcon,
} from 'lucide-react'

export type NavModuleDef = {
  key: string
  label: string
  href: string
  icon: LucideIcon
}

export type NavSection = {
  title?: string
  modules: string[]
}

export type CompanyNav = {
  sections: NavSection[]
  globalBottom: string[]
}

// ── Master module registry ─────────────────────────────────────────────────
export const NAV_MODULES: Record<string, NavModuleDef> = {
  // Globaal
  dashboard:          { key: 'dashboard',          label: 'Dashboard',           href: '/dashboard',                      icon: LayoutDashboard },
  meldingen:          { key: 'meldingen',           label: 'Meldingen',           href: '/dashboard/meldingen',            icon: Bell },
  instellingen:       { key: 'instellingen',        label: 'Instellingen',        href: '/dashboard/instellingen',         icon: Settings },
  health:             { key: 'health',              label: 'System Health',       href: '/dashboard/health',               icon: Activity },
  bedrijven:          { key: 'bedrijven',           label: 'Bedrijven',           href: '/dashboard/companies',            icon: Building2 },
  gebruikers:         { key: 'gebruikers',          label: 'Gebruikers',          href: '/dashboard/gebruikers',           icon: Users },
  documenten:         { key: 'documenten',          label: 'Documenten',          href: '/dashboard/documenten',           icon: Files },
  agenda:             { key: 'agenda',              label: 'Agenda',              href: '/dashboard/agenda',               icon: Calendar },
  taken:              { key: 'taken',               label: 'Taken',               href: '/dashboard/taken',                icon: CheckSquare },

  // AI & Automatisering
  agents:             { key: 'agents',              label: 'AI Agents',           href: '/dashboard/agents',               icon: Bot },
  workflows:          { key: 'workflows',           label: 'Workflow Engine',     href: '/dashboard/workflows',            icon: Workflow },

  // Vastgoed — STRKBEHEER
  vastgoed:           { key: 'vastgoed',            label: 'Vastgoed Deals',      href: '/dashboard/vastgoed',             icon: Home },
  projecten:          { key: 'projecten',           label: 'Projectontwikkeling', href: '/dashboard/projects',             icon: FolderKanban },
  crm:                { key: 'crm',                 label: 'CRM / Leads',         href: '/dashboard/crm',                  icon: Users },
  investor_os:        { key: 'investor_os',         label: 'Investor OS',         href: '/dashboard/investors',            icon: TrendingUp },
  portfolio:          { key: 'portfolio',           label: 'Portfolio',           href: '/dashboard/portfolio',            icon: Layers },

  // Finance — MODIWERIJO
  finance:            { key: 'finance',             label: 'Finance OS',          href: '/dashboard/finance',              icon: Banknote },
  debiteuren:         { key: 'debiteuren',          label: 'Debiteuren',          href: '/dashboard/finance/debiteuren',   icon: Users },
  facturen:           { key: 'facturen',            label: 'Facturen',            href: '/dashboard/finance/facturen',     icon: ReceiptText },
  incasso:            { key: 'incasso',             label: 'Incasso',             href: '/dashboard/finance/incasso',      icon: Scale },
  cashflow:           { key: 'cashflow',            label: 'Cashflow',            href: '/dashboard/financien',            icon: Wallet },
  moneybird:          { key: 'moneybird',           label: 'Moneybird',           href: '/dashboard/admin',                icon: BookOpen },
  belasting:          { key: 'belasting',           label: 'Belastingen',         href: '/dashboard/finance/rapportages',  icon: FileText },
  abonnementen:       { key: 'abonnementen',        label: 'Abonnementen',        href: '/dashboard/abonnementen',         icon: CreditCard },
  admin:              { key: 'admin',               label: 'Administratie',       href: '/dashboard/admin',                icon: FileText },

  // YouTube / Media — MODIWE MEDIA
  youtube:            { key: 'youtube',             label: 'YouTube Engine',      href: '/dashboard/youtube',              icon: Video },
  youtube_analytics:  { key: 'youtube_analytics',  label: 'Analytics',           href: '/dashboard/youtube/analytics',    icon: BarChart3 },
  youtube_queue:      { key: 'youtube_queue',       label: 'Upload Queue',        href: '/dashboard/youtube/queue',        icon: Package },
  youtube_automation: { key: 'youtube_automation',  label: 'Automation',          href: '/dashboard/youtube/automation',   icon: Zap },
  youtube_scheduled:  { key: 'youtube_scheduled',   label: 'Gepland',             href: '/dashboard/youtube/scheduled',    icon: Calendar },
  youtube_logs:       { key: 'youtube_logs',        label: 'Logs',                href: '/dashboard/youtube/logs',         icon: FileText },

  // Bouw — STRKBOUW
  calculaties:        { key: 'calculaties',         label: 'SterkCalc',           href: '/dashboard/calculaties',          icon: Calculator },
  bouwplaats:         { key: 'bouwplaats',          label: 'Bouwplaats',          href: '/dashboard/bouwplaats',           icon: Wrench },
  planning:           { key: 'planning',            label: 'Planning',            href: '/dashboard/planning',             icon: ClipboardList },
  uitvoering:         { key: 'uitvoering',          label: 'Uitvoering',          href: '/dashboard/uitvoering',           icon: Hammer },
  werkbonnen:         { key: 'werkbonnen',          label: 'Werkbonnen',          href: '/dashboard/werkbonnen',           icon: ClipboardList },
  inkoop:             { key: 'inkoop',              label: 'Inkoop',              href: '/dashboard/inkoop',               icon: ShoppingCart },
  meerwerk:           { key: 'meerwerk',            label: 'Meerwerk',            href: '/dashboard/meerwerk',             icon: PlusCircle },
}

// ── Per-company navigatiestructuur ─────────────────────────────────────────
export const COMPANY_NAV: Record<string, CompanyNav> = {
  strkbeheer: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Vastgoed', modules: ['vastgoed', 'projecten', 'portfolio', 'investor_os'] },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance', 'abonnementen'] },
      { title: 'Systeem', modules: ['agents', 'workflows', 'documenten', 'agenda', 'taken'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  strkbouw: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Calculatie', modules: ['calculaties'] },
      { title: 'Bouwplaats', modules: ['projecten', 'bouwplaats', 'planning', 'uitvoering', 'werkbonnen'] },
      { title: 'Inkoop', modules: ['inkoop', 'meerwerk'] },
      { title: 'Finance', modules: ['finance'] },
      { title: 'Systeem', modules: ['documenten', 'agenda', 'taken'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  'modiwe-media': {
    sections: [
      { modules: ['dashboard'] },
      { title: 'YouTube', modules: ['youtube', 'youtube_analytics', 'youtube_queue', 'youtube_automation', 'youtube_scheduled', 'youtube_logs'] },
      { title: 'Automatisering', modules: ['agents', 'workflows'] },
      { title: 'Marketing', modules: ['crm'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  modiwerijo: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'AI OS', modules: ['agents', 'workflows'] },
      { title: 'Finance', modules: ['finance', 'debiteuren', 'facturen', 'incasso', 'cashflow', 'moneybird', 'belasting'] },
      { title: 'Beheer', modules: ['admin', 'abonnementen', 'documenten', 'bedrijven', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  bouwproffs: {
    sections: [
      { modules: ['dashboard'] },
    ],
    globalBottom: ['instellingen'],
  },
}

export function getCompanyNav(companyId: string): CompanyNav {
  return COMPANY_NAV[companyId] ?? COMPANY_NAV['modiwerijo']
}
