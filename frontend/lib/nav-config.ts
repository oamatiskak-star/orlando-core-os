import {
  LayoutDashboard, Home, Building2, FolderKanban, TrendingUp,
  Calculator, Users, Banknote, Video, Bot, Workflow, Files,
  Calendar, Bell, Settings, Activity, CreditCard, CheckSquare,
  FileText, Layers, Zap, BarChart3, Package, Hammer,
  ClipboardList, ShoppingCart, Wrench, PlusCircle, ReceiptText,
  Wallet, Scale, BookOpen, Clock, Truck, HardHat, Landmark,
  Archive, ScrollText, Inbox, ArrowRightLeft,
  UserCheck, LucideIcon, Globe, Key, Coins, BadgeDollarSign,
  Cpu, GitBranch, ListChecks, Terminal, Webhook, PlugZap, Lightbulb, BarChart2, SlidersHorizontal, AlertCircle, ScanLine,
  Mail, Shield, GitMerge, Filter, Brain, ShieldAlert, Link,
  Gavel, Lock, Eye, Upload, Server,
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
  moneybird_live:       { key: 'moneybird_live',       label: 'Moneybird Live',           href: '/dashboard/finance/moneybird',      icon: Link },
  financien:            { key: 'financien',            label: 'Financiën',               href: '/dashboard/financien',             icon: Wallet },
  gebruikers:           { key: 'gebruikers',           label: 'Gebruikers',              href: '/dashboard/gebruikers',            icon: Users },
  instellingen:         { key: 'instellingen',         label: 'Instellingen',            href: '/dashboard/instellingen',          icon: Settings },
  meldingen:            { key: 'meldingen',            label: 'Meldingen',               href: '/dashboard/meldingen',             icon: Bell },
  planning:             { key: 'planning',             label: 'Planning',                href: '/dashboard/planning',              icon: ClipboardList },
  projecten:            { key: 'projecten',            label: 'Projecten',               href: '/dashboard/projects',              icon: FolderKanban },
  health:               { key: 'health',               label: 'System Health',           href: '/dashboard/health',                icon: Activity },
  taken:                { key: 'taken',                label: 'Taken',                   href: '/dashboard/taken',                 icon: CheckSquare },
  workflows:            { key: 'workflows',            label: 'Workflow Engine',         href: '/dashboard/workflows',             icon: Workflow },
  orchestrator:         { key: 'orchestrator',         label: 'Orchestrator',            href: '/dashboard/orchestrator',          icon: ListChecks },
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
  dyme_os:              { key: 'dyme_os',              label: 'Dyme OS · ING',           href: '/dashboard/dyme',                  icon: Coins },
  personal_finance:     { key: 'personal_finance',     label: 'Personal Finance OS',     href: '/dashboard/personal-finance',      icon: BadgeDollarSign },
  dga_loonstrook:       { key: 'dga_loonstrook',       label: 'DGA Loonstroken',         href: '/dashboard/personal-finance/loonstrook', icon: ReceiptText },
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
  youtube_investor:     { key: 'youtube_investor',     label: 'PropertyInvestorTv',      href: '/dashboard/youtube/channel/propertyinvestortv', icon: Video },
  youtube_spaartv:      { key: 'youtube_spaartv',      label: 'SpaarTv',                 href: '/dashboard/youtube/channel/spaartv',         icon: Video },
  youtube_vastgoed:     { key: 'youtube_vastgoed',     label: 'VastgoedTv',              href: '/dashboard/youtube/channel/vastgoedtv',      icon: Video },
  youtube_vermogen:     { key: 'youtube_vermogen',     label: 'VermogenTv',              href: '/dashboard/youtube/channel/vermogentv',      icon: Video },
  youtube_aquier:       { key: 'youtube_aquier',       label: 'AquierTv',                href: '/dashboard/youtube/channel/aquiertv',        icon: Video },
  youtube_aquieres:     { key: 'youtube_aquieres',     label: 'AquierTv ES',             href: '/dashboard/youtube/channel/aquiertves',      icon: Video },
  instagram:            { key: 'instagram',            label: 'Instagram',               href: '/dashboard/social/instagram',      icon: Globe },
  tiktok:               { key: 'tiktok',               label: 'TikTok',                  href: '/dashboard/social/tiktok',         icon: Globe },
  fb_offmarket:         { key: 'fb_offmarket',         label: 'FB Off Market NL',        href: '/dashboard/social/fb-offmarket',   icon: Globe },
  fb_property:          { key: 'fb_property',          label: 'FB Private Property NL',  href: '/dashboard/social/fb-property',    icon: Globe },
  youtube_workflow:     { key: 'youtube_workflow',     label: 'Pipeline',                href: '/dashboard/youtube/workflow',      icon: GitBranch },
  youtube_analytics:    { key: 'youtube_analytics',    label: 'Analytics',               href: '/dashboard/youtube/analytics',     icon: BarChart3 },
  youtube_queue:        { key: 'youtube_queue',        label: 'Upload Queue',            href: '/dashboard/youtube/queue',         icon: Package },
  youtube_automation:   { key: 'youtube_automation',   label: 'Automation',              href: '/dashboard/youtube/automation',    icon: Zap },
  youtube_scheduled:    { key: 'youtube_scheduled',    label: 'Gepland',                 href: '/dashboard/youtube/scheduled',     icon: Calendar },
  youtube_logs:         { key: 'youtube_logs',         label: 'Logs',                    href: '/dashboard/youtube/logs',          icon: FileText },
  youtube_calendar:     { key: 'youtube_calendar',     label: 'Content Calendar',        href: '/dashboard/youtube/calendar',      icon: Calendar },
  youtube_growth:       { key: 'youtube_growth',       label: 'Growth & Kwaliteit',      href: '/dashboard/youtube/growth',        icon: TrendingUp },

  // ── OSIL — STRATEGIC INTELLIGENCE LAYER ──────────────────────────────────
  osil_dashboard:    { key: 'osil_dashboard',    label: 'OSIL Command',        href: '/dashboard/osil',                  icon: Brain },
  osil_board:        { key: 'osil_board',        label: 'Board Sessies',       href: '/dashboard/osil/board',            icon: Users },
  osil_kansen:       { key: 'osil_kansen',       label: 'Kansen Radar',        href: '/dashboard/osil/kansen',           icon: TrendingUp },
  osil_recovery:     { key: 'osil_recovery',     label: 'Recovery Agent',      href: '/dashboard/osil/recovery',         icon: ShieldAlert },
  osil_optimalisatie:{ key: 'osil_optimalisatie',label: 'Financial Optimizer', href: '/dashboard/osil/optimalisatie',    icon: BarChart3 },
  osil_fiscalist:    { key: 'osil_fiscalist',    label: 'AI Fiscalist',        href: '/dashboard/osil/fiscalist',        icon: Scale },
  osil_rapport:      { key: 'osil_rapport',      label: 'Strategisch Rapport', href: '/dashboard/osil/rapport',          icon: FileText },

  // ── AI ADVOCAAT OS ────────────────────────────────────────────────────────
  ai_advocaat:         { key: 'ai_advocaat',         label: 'AI Advocaat OS',       href: '/dashboard/ai-advocaat',               icon: Scale },
  ai_adv_dossiers:     { key: 'ai_adv_dossiers',     label: 'Dossiers',             href: '/dashboard/ai-advocaat/dossiers',      icon: Shield },
  ai_adv_contracten:   { key: 'ai_adv_contracten',   label: 'Contracten',           href: '/dashboard/ai-advocaat/contracten',    icon: ScrollText },
  ai_adv_deadlines:    { key: 'ai_adv_deadlines',    label: 'Deadlines',            href: '/dashboard/ai-advocaat/deadlines',     icon: Clock },
  advocaat_dashboard:  { key: 'advocaat_dashboard',  label: 'Advocaat OS (full)',   href: '/dashboard/advocaat',                  icon: Gavel },
  advocaat_dossiers:   { key: 'advocaat_dossiers',   label: 'Juridische Dossiers',  href: '/dashboard/advocaat/dossiers',         icon: Scale },
  advocaat_curator:    { key: 'advocaat_curator',    label: 'Curator Protectie',    href: '/dashboard/advocaat/curator',          icon: Shield },
  advocaat_tijdlijn:   { key: 'advocaat_tijdlijn',   label: 'Forensische Tijdlijn', href: '/dashboard/advocaat/tijdlijn',         icon: Clock },
  advocaat_bewijs:     { key: 'advocaat_bewijs',     label: 'Bewijs Engine',        href: '/dashboard/advocaat/bewijs',           icon: Lock },
  advocaat_mail_def:   { key: 'advocaat_mail_def',   label: 'Mail Defense',         href: '/dashboard/advocaat/mail-defense',     icon: Eye },
  advocaat_strategie:  { key: 'advocaat_strategie',  label: 'Strategie Engine',     href: '/dashboard/advocaat/strategie',        icon: Brain },
  advocaat_imports:    { key: 'advocaat_imports',    label: 'Data Import Center',   href: '/dashboard/advocaat/imports',          icon: Upload },

  // ── MAIL ENGINE ───────────────────────────────────────────────────────────
  mail_dashboard:       { key: 'mail_dashboard',       label: 'Mail Engine',             href: '/dashboard/mail',                  icon: Mail },
  mail_agents:          { key: 'mail_agents',           label: 'Mail Agents',             href: '/dashboard/mail/agents',           icon: Bot },
  mail_workflows:       { key: 'mail_workflows',        label: 'Mail Workflows',          href: '/dashboard/mail/workflows',        icon: GitMerge },
  mail_rules:           { key: 'mail_rules',            label: 'Routing Rules',           href: '/dashboard/mail/rules',            icon: Filter },
  mail_dossiers:        { key: 'mail_dossiers',         label: 'Juridische Dossiers',     href: '/dashboard/mail/dossiers',         icon: Scale },
  mail_inbox:           { key: 'mail_inbox',            label: 'Inbox',                   href: '/mobile/mail',                     icon: Inbox },

  // ── OPERATIONS CENTER ─────────────────────────────────────────────────────
  ops_dashboard:        { key: 'ops_dashboard',        label: 'Operations',          href: '/dashboard/operations',                      icon: Cpu },
  ops_workflows:        { key: 'ops_workflows',        label: 'Workflow Engine',     href: '/dashboard/operations/workflows',             icon: GitBranch },
  ops_routines:         { key: 'ops_routines',         label: 'Routines',            href: '/dashboard/operations/routines',              icon: ListChecks },
  ops_automations:      { key: 'ops_automations',      label: 'Automations',         href: '/dashboard/operations/automations',           icon: Zap },
  ops_agents:           { key: 'ops_agents',           label: 'AI Agents',           href: '/dashboard/operations/agents',                icon: Bot },
  ops_scheduler:        { key: 'ops_scheduler',        label: 'Scheduler',           href: '/dashboard/operations/scheduler',             icon: Clock },
  ops_queue:            { key: 'ops_queue',            label: 'Queue Monitor',       href: '/dashboard/operations/queue',                 icon: Package },
  ops_logs:             { key: 'ops_logs',             label: 'Logs',                href: '/dashboard/operations/logs',                  icon: Terminal },
  ops_errors:           { key: 'ops_errors',           label: 'Errors',              href: '/dashboard/operations/errors',                icon: AlertCircle },
  ops_notifications:    { key: 'ops_notifications',    label: 'Notificaties',        href: '/dashboard/operations/notifications',         icon: Bell },
  ops_api:              { key: 'ops_api',              label: 'API Connections',     href: '/dashboard/operations/api-connections',       icon: PlugZap },
  ops_suggestions:      { key: 'ops_suggestions',      label: 'AI Suggestions',      href: '/dashboard/operations/ai-suggestions',        icon: Lightbulb },
  ops_manual:           { key: 'ops_manual',           label: 'Manual Tasks',        href: '/dashboard/operations/manual-tasks',          icon: CheckSquare },
  ops_templates:        { key: 'ops_templates',        label: 'Templates',           href: '/dashboard/operations/templates',             icon: Layers },
  ops_webhooks:         { key: 'ops_webhooks',         label: 'Webhooks',            href: '/dashboard/operations/webhooks',              icon: Webhook },
  ops_analytics:        { key: 'ops_analytics',        label: 'Analytics',           href: '/dashboard/operations/analytics',             icon: BarChart2 },
  ops_company_settings: { key: 'ops_company_settings', label: 'Company Settings',    href: '/dashboard/operations/company-settings',      icon: SlidersHorizontal },
  ops_global_settings:  { key: 'ops_global_settings',  label: 'Global Settings',     href: '/dashboard/operations/global-settings',       icon: Settings },
  ops_dil:              { key: 'ops_dil',              label: 'Document Intelligence', href: '/dashboard/document-intelligence',          icon: ScanLine },
  infra:                { key: 'infra',                label: 'Infrastructuur',         href: '/dashboard/infra',                          icon: Server },
}

// ── Per-company nav — exact op basis van Drive mapstructuur ────────────────
export const COMPANY_NAV: Record<string, CompanyNav> = {

  // O.S.M. AMATISKAK
  osm: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
      { title: 'OSIL', modules: ['osil_dashboard', 'osil_board', 'osil_kansen', 'osil_recovery', 'osil_optimalisatie', 'osil_fiscalist', 'osil_rapport'] },
      { title: 'Persoonlijk', modules: ['dyme_os', 'personal_finance', 'dga_loonstrook', 'loonstroken', 'financien'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      { title: 'Operationeel', modules: ['agenda', 'taken', 'planning', 'crm'] },
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'belasting', 'abonnementen', 'documenten'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Modiwerijo Financial Management BV
  modiwerijo: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
      { title: 'OSIL', modules: ['osil_dashboard', 'osil_board', 'osil_kansen', 'osil_recovery', 'osil_optimalisatie', 'osil_fiscalist', 'osil_rapport'] },
      { title: 'Finance', modules: ['finance_incasso', 'moneybird_live', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      {
        title: 'Personeel', modules: [
          'personeel', 'personeel_medew', 'personeel_contract',
          'personeel_loon', 'personeel_admini', 'personeel_ubo',
        ],
      },
      { title: 'Operationeel', modules: ['projecten', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Modiwe Media BV
  'modiwe-media': {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
      {
        title: 'YouTube', modules: [
          'youtube',
          'youtube_vermogen', 'youtube_spaartv', 'youtube_vastgoed',
          'youtube_crypto', 'youtube_beleggingstv', 'youtube_investor', 'youtube_aquier', 'youtube_aquieres',
        ],
      },
      { title: 'YouTube Tools', modules: ['youtube_workflow', 'youtube_analytics', 'youtube_queue', 'youtube_automation', 'youtube_calendar', 'youtube_scheduled', 'youtube_logs', 'youtube_growth'] },
      { title: 'Social Media', modules: ['instagram', 'tiktok', 'fb_offmarket', 'fb_property'] },
      { title: 'Vastgoed', modules: ['vastgoed'] },
      { title: 'Operationeel', modules: ['projecten', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // Modiwe Software BV
  'modiwe-software': {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
      { title: 'SaaS', modules: ['calculaties', 'vastgoed', 'projecten'] },
      {
        title: 'YouTube', modules: [
          'youtube',
          'youtube_vermogen', 'youtube_spaartv', 'youtube_vastgoed',
          'youtube_crypto', 'youtube_beleggingstv', 'youtube_investor', 'youtube_aquier', 'youtube_aquieres',
        ],
      },
      { title: 'Operationeel', modules: ['planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // STRKBEHEER BV
  strkbeheer: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
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
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // STRKBOUW BV
  strkbouw: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
      { title: 'Bouw', modules: ['calculaties', 'bouwplaats', 'projecten', 'planning'] },
      { title: 'Portaal', modules: ['kopers_portaal'] },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['documenten', 'agenda', 'taken'] },
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Bouwproffs BV
  bouwproffs: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports', 'ai_advocaat', 'ai_adv_dossiers', 'ai_adv_contracten', 'ai_adv_deadlines'] },
      { title: 'Calculatie', modules: ['calculaties', 'projecten', 'planning'] },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'moneybird_live', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['documenten', 'agenda', 'taken'] },
      { title: 'Operations Center', modules: ['ops_dashboard', 'ops_workflows', 'ops_routines', 'ops_agents', 'ops_scheduler', 'ops_queue', 'ops_logs', 'ops_errors', 'ops_automations', 'ops_api', 'ops_dil', 'ops_suggestions', 'ops_manual', 'ops_templates', 'ops_webhooks', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },
}

export function getCompanyNav(companyId: string): CompanyNav {
  return COMPANY_NAV[companyId] ?? COMPANY_NAV['modiwerijo']
}
