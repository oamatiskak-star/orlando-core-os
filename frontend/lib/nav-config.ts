import {
  LayoutDashboard, Home, Building2, FolderKanban, TrendingUp,
  Calculator, Users, Banknote, Video, Bot, Workflow, Files,
  Calendar, Bell, Settings, Activity, CreditCard, CheckSquare,
  FileText, Layers, Zap, BarChart3, Package, Hammer,
  ClipboardList, ShoppingCart, Wrench, PlusCircle, ReceiptText,
  Wallet, Scale, BookOpen, Clock, Truck, HardHat, Landmark,
  Archive, ScrollText, Inbox, ArrowRightLeft,
  UserCheck, LucideIcon, Globe, Key, Coins, BadgeDollarSign,
} from 'lucide-react'

export type NavModuleDef = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  badge?: number
}

export type NavSection = {
  title?: string
  modules: string[]
}

export type CompanyNav = {
  sections: NavSection[]
  globalBottom: string[]
}

// ── Master module registry — gebaseerd op Drive mapstructuur ───────────────
export const NAV_MODULES: Record<string, NavModuleDef> = {

  // ── GLOBAAL (aanwezig bij alle bedrijven) ─────────────────────────────────
  dashboard:            { key: 'dashboard',            label: 'Dashboard',               href: '/dashboard',                       icon: LayoutDashboard },
  administratie:        { key: 'administratie',        label: 'Administratie',           href: '/dashboard/admin',                 icon: FileText },
  agenda:               { key: 'agenda',               label: 'Agenda',                  href: '/dashboard/agenda',                icon: Calendar },
  agents:               { key: 'agents',               label: 'AI Agents',               href: '/dashboard/agents',                icon: Bot },
  belasting:            { key: 'belasting',            label: 'Belasting',               href: '/dashboard/finance/rapportages',   icon: BookOpen },
  crm:                  { key: 'crm',                  label: 'CRM',                     href: '/dashboard/crm',                   icon: Users },
  documenten:           { key: 'documenten',           label: 'Documenten',              href: '/dashboard/documenten',            icon: Files },
  finance_incasso:      { key: 'finance_incasso',      label: 'Finance & Incasso',       href: '/dashboard/finance',               icon: Banknote },
  financien:            { key: 'financien',            label: 'Financiën',               href: '/dashboard/financien',             icon: Wallet },
  gebruikers:           { key: 'gebruikers',           label: 'Gebruikers',              href: '/dashboard/gebruikers',            icon: Users },
  instellingen:         { key: 'instellingen',         label: 'Instellingen',            href: '/dashboard/instellingen',          icon: Settings },
  meldingen:            { key: 'meldingen',            label: 'Meldingen',               href: '/dashboard/meldingen',             icon: Bell },
  planning:             { key: 'planning',             label: 'Planning',                href: '/dashboard/planning',              icon: ClipboardList },
  projecten:            { key: 'projecten',            label: 'Projecten',               href: '/dashboard/projects',              icon: FolderKanban },
  health:               { key: 'health',               label: 'System Health',           href: '/dashboard/health',                icon: Activity },
  taken:                { key: 'taken',                label: 'Taken',                   href: '/dashboard/taken',                 icon: CheckSquare },
  workflows:            { key: 'workflows',            label: 'Workflow Engine',         href: '/dashboard/workflows',             icon: Workflow },
  abonnementen:         { key: 'abonnementen',         label: 'Abonnementen',            href: '/dashboard/abonnementen',          icon: CreditCard },

  // ── BEDRIJFSSTRUCTUUR ─────────────────────────────────────────────────────
  bedrijven:            { key: 'bedrijven',            label: 'Bedrijven',               href: '/dashboard/companies',             icon: Building2 },

  // ── PERSONEEL ─────────────────────────────────────────────────────────────
  personeel:            { key: 'personeel',            label: 'Personeel',               href: '/dashboard/personeel',             icon: Users },
  personeel_admini:     { key: 'personeel_admini',     label: 'Administratie',           href: '/dashboard/personeel/admin',       icon: FileText },
  personeel_contract:   { key: 'personeel_contract',   label: 'Contracten',              href: '/dashboard/personeel/contracten',  icon: ScrollText },
  personeel_docs:       { key: 'personeel_docs',       label: 'Documenten',              href: '/dashboard/personeel/documenten',  icon: Files },
  personeel_loon:       { key: 'personeel_loon',       label: 'Loonstroken',             href: '/dashboard/personeel/loonstroken', icon: ReceiptText },
  personeel_medew:      { key: 'personeel_medew',      label: 'Medewerkers',             href: '/dashboard/personeel/medewerkers', icon: UserCheck },
  personeel_ubo:        { key: 'personeel_ubo',        label: 'UBO Register',            href: '/dashboard/personeel/ubo',         icon: Key },

  // ── O.S.M. AMATISKAK specifiek ────────────────────────────────────────────
  dyme_os:              { key: 'dyme_os',              label: 'Dyme OS',                 href: '/dashboard/dyme',                  icon: Coins },
  personal_finance:     { key: 'personal_finance',     label: 'Personal Finance OS',     href: '/dashboard/personal-finance',      icon: BadgeDollarSign },
  loonstroken:          { key: 'loonstroken',          label: 'Loonstroken',             href: '/dashboard/loonstroken',           icon: ReceiptText },

  // ── STRKBEHEER — VASTGOED ─────────────────────────────────────────────────
  vastgoed:             { key: 'vastgoed',             label: 'Vastgoed Deals',          href: '/dashboard/vastgoed',              icon: Home },
  calculaties:          { key: 'calculaties',          label: 'Calculaties',             href: '/dashboard/calculaties',           icon: Calculator },

  // ── STRKBOUW — BOUW ───────────────────────────────────────────────────────
  bouwplaats:           { key: 'bouwplaats',           label: 'BouwplaatsApp',           href: '/dashboard/bouwplaats',            icon: HardHat },
  kopers_portaal:       { key: 'kopers_portaal',       label: 'Kopers & Huurders',       href: '/dashboard/kopers-portaal',        icon: UserCheck },

  // ── MODIWE MEDIA — YOUTUBE & SOCIAL ──────────────────────────────────────
  youtube:              { key: 'youtube',              label: 'YouTube Engine',          href: '/dashboard/youtube',               icon: Video },
  youtube_beleggingstv: { key: 'youtube_beleggingstv', label: 'BeleggingsTv',            href: '/dashboard/youtube/channel/beleggingstv',    icon: Video },
  youtube_crypto:       { key: 'youtube_crypto',       label: 'CryptoVermogen',          href: '/dashboard/youtube/channel/cryptovermogen',  icon: Video },
  youtube_investor:     { key: 'youtube_investor',     label: 'Private InvestorTv',      href: '/dashboard/youtube/channel/investortv',      icon: Video },
  youtube_spaartv:      { key: 'youtube_spaartv',      label: 'SpaarTv',                 href: '/dashboard/youtube/channel/spaartv',         icon: Video },
  youtube_vastgoed:     { key: 'youtube_vastgoed',     label: 'VastgoedTv',              href: '/dashboard/youtube/channel/vastgoedtv',      icon: Video },
  youtube_vermogen:     { key: 'youtube_vermogen',     label: 'VermogenTv',              href: '/dashboard/youtube/channel/vermogentv',      icon: Video },
  instagram:            { key: 'instagram',            label: 'Instagram',               href: '/dashboard/social/instagram',      icon: Globe },
  tiktok:               { key: 'tiktok',               label: 'TikTok',                  href: '/dashboard/social/tiktok',         icon: Globe },
  fb_offmarket:         { key: 'fb_offmarket',         label: 'FB Off Market NL',        href: '/dashboard/social/fb-offmarket',   icon: Globe },
  fb_property:          { key: 'fb_property',          label: 'FB Private Property NL',  href: '/dashboard/social/fb-property',    icon: Globe },
  youtube_analytics:    { key: 'youtube_analytics',    label: 'Analytics',               href: '/dashboard/youtube/analytics',     icon: BarChart3 },
  youtube_queue:        { key: 'youtube_queue',        label: 'Upload Queue',            href: '/dashboard/youtube/queue',         icon: Package },
  youtube_automation:   { key: 'youtube_automation',   label: 'Automation',              href: '/dashboard/youtube/automation',    icon: Zap },
  youtube_scheduled:    { key: 'youtube_scheduled',    label: 'Gepland',                 href: '/dashboard/youtube/scheduled',     icon: Calendar },
  youtube_logs:         { key: 'youtube_logs',         label: 'Logs',                    href: '/dashboard/youtube/logs',          icon: FileText },
}

// ── Per-company nav — exact op basis van Drive mapstructuur ────────────────
export const COMPANY_NAV: Record<string, CompanyNav> = {

  // O.S.M. AMATISKAK
  osm: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Persoonlijk', modules: ['dyme_os', 'personal_finance', 'loonstroken', 'financien'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      { title: 'Operationeel', modules: ['agenda', 'taken', 'planning', 'crm'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'belasting', 'abonnementen', 'documenten'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Modiwerijo Financial Management BV
  modiwerijo: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      {
        title: 'Personeel', modules: [
          'personeel', 'personeel_medew', 'personeel_contract',
          'personeel_loon', 'personeel_admini', 'personeel_ubo',
        ],
      },
      { title: 'Operationeel', modules: ['projecten', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Modiwe Media BV
  'modiwe-media': {
    sections: [
      { modules: ['dashboard'] },
      {
        title: 'YouTube', modules: [
          'youtube',
          'youtube_vermogen', 'youtube_spaartv', 'youtube_vastgoed',
          'youtube_crypto', 'youtube_beleggingstv', 'youtube_investor',
        ],
      },
      { title: 'YouTube Tools', modules: ['youtube_analytics', 'youtube_queue', 'youtube_automation', 'youtube_scheduled', 'youtube_logs'] },
      { title: 'Social Media', modules: ['instagram', 'tiktok', 'fb_offmarket', 'fb_property'] },
      { title: 'Vastgoed', modules: ['vastgoed'] },
      { title: 'Operationeel', modules: ['projecten', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // Modiwe Software BV
  'modiwe-software': {
    sections: [
      { modules: ['dashboard'] },
      { title: 'SaaS', modules: ['calculaties', 'vastgoed', 'projecten'] },
      {
        title: 'YouTube', modules: [
          'youtube',
          'youtube_vermogen', 'youtube_spaartv', 'youtube_vastgoed',
          'youtube_crypto', 'youtube_beleggingstv', 'youtube_investor',
        ],
      },
      { title: 'Operationeel', modules: ['planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // STRKBEHEER BV
  strkbeheer: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Vastgoed', modules: ['vastgoed', 'calculaties', 'projecten', 'planning'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      {
        title: 'Personeel', modules: [
          'personeel', 'personeel_medew', 'personeel_contract',
          'personeel_loon', 'personeel_admini', 'personeel_ubo',
        ],
      },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['documenten', 'agenda', 'taken'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // STRKBOUW BV
  strkbouw: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Bouw', modules: ['calculaties', 'bouwplaats', 'projecten', 'planning'] },
      { title: 'Portaal', modules: ['kopers_portaal'] },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['documenten', 'agenda', 'taken'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Bouwproffs BV
  bouwproffs: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Calculatie', modules: ['calculaties', 'projecten', 'planning'] },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['documenten', 'agenda', 'taken'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },
}

export function getCompanyNav(companyId: string): CompanyNav {
  return COMPANY_NAV[companyId] ?? COMPANY_NAV['modiwerijo']
}
