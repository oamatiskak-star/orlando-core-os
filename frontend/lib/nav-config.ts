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
  Gavel, Lock, Eye, Upload, Server, Tv2, Music,
  Radar, MapPin, Target, Megaphone, UserPlus, Maximize2,
  Briefcase, GanttChart, UserCog, Gauge, ThumbsUp, Sparkles,
} from 'lucide-react'

export type NavModuleDef = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  badge?: number
  external?: boolean  // open in nieuw tabblad (voor externe URLs)
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
  hermes_ceo:           { key: 'hermes_ceo',           label: 'Hermes CEO · Controle',   href: '/dashboard/hermes',                icon: Brain },

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
  media_holding:        { key: 'media_holding',        label: 'Media Holding OS',        href: '/dashboard/media-holding',         icon: Tv2 },
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
  youtube_brickpulse:   { key: 'youtube_brickpulse',   label: 'BrickPulse Lab',          href: '/dashboard/youtube/channel/brickpulse',   icon: Video },
  youtube_loopforge:    { key: 'youtube_loopforge',    label: 'LoopForge AI',            href: '/dashboard/youtube/channel/loopforge',    icon: Video },
  youtube_slicetheory:  { key: 'youtube_slicetheory',  label: 'SliceTheory',             href: '/dashboard/youtube/channel/slicetheory',  icon: Video },

  // ── MEDIA HOLDING OS — suite-pagina's (consolidatie: geen dubbele YouTube-layer) ──
  mh_executive:         { key: 'mh_executive',         label: 'Executive Boardroom',     href: '/dashboard/media-holding/executive',          icon: Brain },
  mh_channels:          { key: 'mh_channels',          label: 'Alle Kanalen',            href: '/dashboard/media-holding/channels',           icon: Tv2 },
  mh_incubator:         { key: 'mh_incubator',         label: 'Channel Incubator',       href: '/dashboard/media-holding/channel-incubator',  icon: PlusCircle },
  mh_content_factory:   { key: 'mh_content_factory',   label: 'Content Factory',         href: '/dashboard/media-holding/content-factory',    icon: Package },
  mh_compete:           { key: 'mh_compete',           label: 'Competitor Scanner',      href: '/dashboard/media-holding/compete',            icon: Radar },
  mh_trend_scanner:     { key: 'mh_trend_scanner',     label: 'Trend Scanner',           href: '/dashboard/media-holding/trend-scanner',      icon: TrendingUp },
  mh_viral:             { key: 'mh_viral',             label: 'Viral Intelligence',      href: '/dashboard/media-holding/viral-intelligence', icon: Sparkles },
  mh_retention:         { key: 'mh_retention',         label: 'Retention Lab',           href: '/dashboard/media-holding/retention-lab',      icon: Activity },
  mh_hooks:             { key: 'mh_hooks',             label: 'Hook Library',            href: '/dashboard/media-holding/hook-library',       icon: Lightbulb },
  mh_monetization:      { key: 'mh_monetization',      label: 'Revenue & Affiliate',     href: '/dashboard/media-holding/monetization',       icon: BadgeDollarSign },
  mh_launches:          { key: 'mh_launches',          label: 'Launches',                href: '/dashboard/media-holding/launches',           icon: Megaphone },
  mh_workers:           { key: 'mh_workers',           label: 'Media Workers',           href: '/dashboard/media-holding/workers',            icon: Server },
  mh_analytics:         { key: 'mh_analytics',         label: 'Holding Analytics',       href: '/dashboard/media-holding/analytics',          icon: BarChart3 },
  mh_autopilot:         { key: 'mh_autopilot',         label: 'Autopilot',               href: '/dashboard/media-holding/autopilot',          icon: Zap },
  mh_settings:          { key: 'mh_settings',          label: 'Instellingen & Platforms', href: '/dashboard/media-holding/settings',          icon: SlidersHorizontal },
  mh_audio:             { key: 'mh_audio',             label: 'Audio Library',           href: '/dashboard/media-holding/audio-library',      icon: Music },
  mh_algorithm_gravity: { key: 'mh_algorithm_gravity', label: 'Algorithm Gravity',       href: '/dashboard/media-holding/algorithm-gravity',  icon: Activity },
  mh_sponsor:           { key: 'mh_sponsor',           label: 'Sponsor Engine',          href: '/dashboard/media-holding/sponsor-engine',     icon: Briefcase },
  mh_affiliate:         { key: 'mh_affiliate',         label: 'Affiliate Engine',        href: '/dashboard/media-holding/affiliate-engine',   icon: Link },
  mh_language:          { key: 'mh_language',          label: 'Language Expansion',      href: '/dashboard/media-holding/language-expansion', icon: Globe },
  mh_crossplatform:     { key: 'mh_crossplatform',     label: 'Cross-Platform',          href: '/dashboard/media-holding/cross-platform',     icon: Layers },
  mh_archives:          { key: 'mh_archives',          label: 'Archives',                href: '/dashboard/media-holding/archives',           icon: Archive },

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
  ops_worker_control:   { key: 'ops_worker_control',   label: 'Worker Control',      href: '/dashboard/operations/worker-control',        icon: Server },
  ops_ai_optimizer:     { key: 'ops_ai_optimizer',     label: 'AI Optimizer',        href: '/dashboard/operations/ai-optimizer',          icon: Sparkles },
  ops_dispatch:         { key: 'ops_dispatch',         label: 'Dispatch (CLI-L/R)',  href: '/dashboard/operations/dispatch',              icon: ArrowRightLeft },
  ops_hermes:           { key: 'ops_hermes',           label: 'Hermes Cockpit',      href: '/dashboard/operations/hermes',                icon: Gauge },
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
  worktree_manager:     { key: 'worktree_manager',     label: 'Worktree Manager',       href: '/dashboard/worktrees',                      icon: GitBranch },

  // ── AQUIER — GLOBAL EXPANSION COMMAND ────────────────────────────────────
  aquier_hub:          { key: 'aquier_hub',          label: 'Aquier',                  href: '/dashboard/aquier',                  icon: Globe },
  aquier_projecten:    { key: 'aquier_projecten',    label: 'Projecten',               href: '/dashboard/aquier/projecten',        icon: Briefcase },
  aquier_planning:     { key: 'aquier_planning',     label: 'Sprints',                 href: '/dashboard/aquier/planning',         icon: GanttChart },
  aquier_agenda:       { key: 'aquier_agenda',       label: 'Agenda',                  href: '/dashboard/aquier/agenda',           icon: Calendar },
  aquier_ai_lead:      { key: 'aquier_ai_lead',      label: 'AI Project Leider',       href: '/dashboard/aquier/ai-lead',          icon: UserCog },
  aquier_monitor:      { key: 'aquier_monitor',      label: 'Dagelijkse Monitoring',   href: '/dashboard/aquier/monitor',          icon: Gauge },
  aquier_approvals:    { key: 'aquier_approvals',    label: 'Approve / Decline',       href: '/dashboard/aquier/approvals',        icon: ThumbsUp },
  aquier_audit:        { key: 'aquier_audit',        label: 'Checkout Audit',          href: '/dashboard/aquier/audit',            icon: ShieldAlert },
  aquier_forecast:     { key: 'aquier_forecast',     label: 'Forecast',                href: '/dashboard/aquier-forecast',         icon: BarChart3 },
  aquier_verzamelaar:  { key: 'aquier_verzamelaar',  label: 'Verzamelaar (Aquier.com)', href: 'https://aquier.com/verzamelaar',    icon: Archive, external: true },

  // ── BUILD TRACKER (per-entity) ────────────────────────────────────────────
  build_tracker:       { key: 'build_tracker',       label: 'Build Tracker',           href: '/dashboard/build-tracker',           icon: Hammer },
  osm:                 { key: 'osm',                 label: 'OSM',                     href: '/dashboard/osm',                     icon: Cpu },
  accounts:            { key: 'accounts',            label: 'Accounts & Affiliates',   href: '/dashboard/accounts',                icon: Key },

  // ── AFFILIATE & REVENUE INFRASTRUCTURE (programma-registry, migratie 100) ──
  account_setup_hub:     { key: 'account_setup_hub',     label: 'Affiliate Programs', href: '/dashboard/account-setup',                 icon: Layers },
  account_setup_accounts:{ key: 'account_setup_accounts',label: 'Programma Registry', href: '/dashboard/account-setup/accounts',        icon: UserCheck },
  account_setup_action:  { key: 'account_setup_action',  label: 'Requires Action',    href: '/dashboard/account-setup/requires-action', icon: AlertCircle },

  // ── HOLDING ECOSYSTEM (24-milestone roadmap, holding-niveau) ──────────────
  holding_milestones:  { key: 'holding_milestones',  label: 'Holding Ecosystem',       href: '/dashboard/holding-milestones',      icon: Target },
  seo_network:         { key: 'seo_network',         label: 'SEO Network (M4)',        href: '/dashboard/seo-network',             icon: Globe },

  // ── ROUTINES CONTROL CENTER (meta-supervisor laag binnen Build Tracker) ──
  // Fase 1 modules — read-only observability. Builder/Recovery/Settings/
  // Intelligence/Analytics komen in latere fases (zie layout sub-nav).
  routines_hub:    { key: 'routines_hub',    label: 'Routines Control',   href: '/dashboard/build-tracker/routines',         icon: Workflow },
  routines_live:   { key: 'routines_live',   label: 'Live Operations',    href: '/dashboard/build-tracker/routines/live',    icon: Activity },
  routines_agents: { key: 'routines_agents', label: 'Routine Agents',     href: '/dashboard/build-tracker/routines/agents',  icon: Bot },
  routines_logs:   { key: 'routines_logs',   label: 'Routine Audit Log',  href: '/dashboard/build-tracker/routines/logs',    icon: Terminal },

  // ── ACQUISITION INTELLIGENCE ─────────────────────────────────────────────
  acq_deal_desk:      { key: 'acq_deal_desk',      label: 'Deal Desk',            href: '/dashboard/acquisition',                     icon: Target },
  acq_deals:          { key: 'acq_deals',          label: 'DealRadar',            href: '/dashboard/acquisition/deals',               icon: Radar },
  acq_build_opps:     { key: 'acq_build_opps',     label: 'BouwRadar',            href: '/dashboard/acquisition/build-opportunities',  icon: HardHat },
  acq_offmarket:      { key: 'acq_offmarket',      label: 'OffMarket Engine',     href: '/dashboard/acquisition/offmarket',           icon: MapPin },
  acq_permits:        { key: 'acq_permits',        label: 'Permit Intelligence',  href: '/dashboard/acquisition/permits',             icon: ScrollText },
  acq_municipalities: { key: 'acq_municipalities', label: 'Gemeente Intel',       href: '/dashboard/acquisition/municipalities',      icon: Landmark },
  acq_investors:      { key: 'acq_investors',      label: 'Investor Match',       href: '/dashboard/acquisition/investors',           icon: UserPlus },
  acq_crm:            { key: 'acq_crm',            label: 'Acquisitie CRM',       href: '/dashboard/acquisition/crm',                 icon: Users },
  acq_outreach:       { key: 'acq_outreach',       label: 'Outreach Automatie',   href: '/dashboard/acquisition/outreach',            icon: Megaphone },
  acq_analytics:      { key: 'acq_analytics',      label: 'Deal Analytics',       href: '/dashboard/acquisition/analytics',           icon: BarChart3 },
  acq_settings:       { key: 'acq_settings',       label: 'Acquisition Settings', href: '/dashboard/acquisition/settings',            icon: SlidersHorizontal },
  acq_leads:          { key: 'acq_leads',          label: 'Leads (aanvragen)',    href: '/dashboard/acquisition/leads',               icon: Inbox },
  acq_scaling:        { key: 'acq_scaling',        label: 'Scaling Engine',       href: '/dashboard/acquisition/scaling',             icon: Maximize2 },
  acq_agents:         { key: 'acq_agents',         label: 'Acquisition Agents',   href: '/dashboard/acquisition/agents',              icon: Bot },
}

// ─────────────────────────────────────────────────────────────────────────
// Role-based nav (sessie 2026-05-23 cleanup):
//   - Juridisch (advocaat_* + ai_advocaat_*)  → osm only
//   - Media Holding + YouTube + Social        → modiwe-media only
//   - Aquier + Scrapers + SaaS Tools          → modiwe-software only
//   - Vastgoed deals + Acquisitie             → strkbeheer
//   - Calculaties + Bouw                       → strkbouw + bouwproffs
//   - Operations Center + Mail Engine + AI    → osm only
//   - Systeem (administratie/gebruikers)      → osm only
//   - Finance + Operationeel                  → per company waar relevant
// ─────────────────────────────────────────────────────────────────────────
export const COMPANY_NAV: Record<string, CompanyNav> = {

  // O.S.M. AMATISKAK — eigenaar (volledige governance + persoonlijk)
  osm: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Hermes CEO', modules: ['hermes_ceo'] },
      { title: 'Juridisch', modules: ['advocaat_dashboard', 'advocaat_dossiers', 'advocaat_curator', 'advocaat_mail_def', 'advocaat_bewijs', 'advocaat_tijdlijn', 'advocaat_strategie', 'advocaat_imports'] },
      { title: 'OSIL', modules: ['osil_dashboard', 'osil_board', 'osil_kansen', 'osil_recovery', 'osil_optimalisatie', 'osil_fiscalist', 'osil_rapport'] },
      { title: 'Persoonlijk', modules: ['dyme_os', 'personal_finance', 'dga_loonstrook', 'loonstroken', 'financien'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      { title: 'Operationeel', modules: ['build_tracker', 'osm', 'accounts', 'agenda', 'taken', 'planning', 'crm'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
      { title: 'Operations',         modules: ['ops_dashboard', 'ops_hermes', 'ops_worker_control', 'ops_dispatch', 'ops_errors', 'ops_logs'] },
      { title: 'Automatisering',     modules: ['ops_workflows', 'ops_automations', 'ops_agents', 'ops_ai_optimizer', 'ops_suggestions', 'ops_manual', 'ops_templates'] },
      { title: 'Operations · Config', modules: ['ops_dil', 'ops_analytics', 'ops_company_settings', 'ops_global_settings', 'infra', 'worktree_manager'] },
      { title: 'Mail Engine', modules: ['mail_dashboard', 'mail_agents', 'mail_workflows', 'mail_rules', 'mail_dossiers', 'mail_inbox'] },
      { title: 'AI & Workflow', modules: ['agents', 'workflows', 'orchestrator'] },
      { title: 'Systeem', modules: ['administratie', 'belasting', 'abonnementen', 'documenten', 'gebruikers'] },
    ],
    globalBottom: ['health', 'meldingen', 'instellingen'],
  },

  // Modiwerijo Financial Management BV — financiële holding
  modiwerijo: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'OSIL', modules: ['osil_dashboard', 'osil_board', 'osil_kansen', 'osil_recovery', 'osil_optimalisatie', 'osil_fiscalist', 'osil_rapport'] },
      { title: 'Finance', modules: ['finance_incasso', 'moneybird_live', 'belasting', 'abonnementen'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      {
        title: 'Personeel', modules: [
          'personeel', 'personeel_medew', 'personeel_contract',
          'personeel_loon', 'personeel_admini', 'personeel_ubo',
        ],
      },
      { title: 'Operationeel', modules: ['build_tracker', 'osm', 'accounts', 'projecten', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Affiliate & Revenue', modules: ['account_setup_hub', 'account_setup_accounts', 'account_setup_action'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // Modiwe Media BV — media + content (Media Holding only here)
  'modiwe-media': {
    sections: [
      { modules: ['dashboard'] },
      // ── MEDIA HOLDING OS — 6 schone groepen, geen dubbele upload/analytics-layer ──
      { title: 'Cockpit',       modules: ['media_holding', 'mh_executive', 'mh_analytics'] },
      {
        title: 'Kanalen', modules: [
          'mh_channels', 'mh_incubator',
          'youtube_vermogen', 'youtube_spaartv', 'youtube_vastgoed', 'youtube_crypto',
          'youtube_beleggingstv', 'youtube_investor', 'youtube_aquier', 'youtube_aquieres',
          'youtube_brickpulse', 'youtube_loopforge', 'youtube_slicetheory',
        ],
      },
      { title: 'Productie',     modules: ['mh_content_factory', 'mh_hooks', 'mh_audio', 'mh_retention'] },
      { title: 'Intelligence',  modules: ['mh_viral', 'mh_trend_scanner', 'mh_compete', 'mh_algorithm_gravity'] },
      { title: 'Groei & Geld',  modules: ['mh_monetization', 'mh_sponsor', 'mh_launches', 'mh_language'] },
      { title: 'Beheer',        modules: ['mh_workers', 'mh_autopilot', 'mh_settings', 'mh_archives'] },
      { title: 'Social Media',  modules: ['instagram', 'tiktok'] },
      { title: 'Finance',       modules: ['finance_incasso', 'financien'] },
      { title: 'Operationeel',  modules: ['build_tracker', 'osm', 'accounts', 'projecten', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // Modiwe Software BV — Aquier + scrapers + SaaS tools
  'modiwe-software': {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Aquier', modules: ['aquier_hub', 'aquier_verzamelaar', 'aquier_projecten', 'aquier_planning', 'aquier_agenda', 'aquier_ai_lead', 'aquier_monitor', 'aquier_approvals', 'aquier_audit', 'aquier_forecast'] },
      { title: 'Scrapers & Data', modules: ['acq_offmarket', 'acq_permits', 'acq_municipalities'] },
      { title: 'Acquisitie', modules: ['acq_leads'] },
      { title: 'Social', modules: ['fb_offmarket', 'fb_property'] },
      { title: 'SaaS', modules: ['projecten'] },
      { title: 'Holding Ecosystem', modules: ['holding_milestones', 'seo_network'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien'] },
      { title: 'Operationeel', modules: ['build_tracker', 'osm', 'accounts', 'planning', 'crm', 'documenten', 'agenda', 'taken'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // STRKBEHEER BV — vastgoed deals + holding
  strkbeheer: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Vastgoed', modules: ['vastgoed', 'projecten', 'planning'] },
      { title: 'Acquisitie', modules: ['acq_deal_desk', 'acq_leads', 'acq_deals', 'acq_build_opps', 'acq_investors', 'acq_crm', 'acq_outreach', 'acq_analytics', 'acq_agents', 'acq_scaling', 'acq_settings'] },
      { title: 'Bedrijven', modules: ['bedrijven'] },
      {
        title: 'Personeel', modules: [
          'personeel', 'personeel_medew', 'personeel_contract',
          'personeel_loon', 'personeel_admini', 'personeel_ubo',
        ],
      },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'financien', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['build_tracker', 'osm', 'accounts', 'documenten', 'agenda', 'taken'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // STRKBOUW BV — bouwbedrijf
  strkbouw: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Bouw', modules: ['calculaties', 'bouwplaats', 'projecten', 'planning'] },
      { title: 'Klanten', modules: ['kopers_portaal', 'crm'] },
      { title: 'Acquisitie', modules: ['acq_leads'] },
      { title: 'Finance', modules: ['finance_incasso', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['build_tracker', 'osm', 'accounts', 'documenten', 'agenda', 'taken'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },

  // Bouwproffs BV — calculatiebureau
  bouwproffs: {
    sections: [
      { modules: ['dashboard'] },
      { title: 'Calculatie', modules: ['calculaties', 'projecten', 'planning'] },
      { title: 'CRM', modules: ['crm'] },
      { title: 'Finance', modules: ['finance_incasso', 'moneybird_live', 'belasting', 'abonnementen'] },
      { title: 'Operationeel', modules: ['build_tracker', 'osm', 'accounts', 'documenten', 'agenda', 'taken'] },
      { title: 'Routines Control', modules: ['routines_hub', 'routines_live', 'routines_agents', 'routines_logs'] },
    ],
    globalBottom: ['meldingen', 'instellingen'],
  },
}

export function getCompanyNav(companyId: string): CompanyNav {
  return COMPANY_NAV[companyId] ?? COMPANY_NAV['modiwerijo']
}
