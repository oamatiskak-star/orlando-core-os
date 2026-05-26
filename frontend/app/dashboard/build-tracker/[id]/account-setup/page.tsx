import { ChevronLeft, KeyRound, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import AccountSetupAgent from './AccountSetupAgent'
import type { BusinessProfile } from '@/lib/account-setup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Task = {
  id: string
  name: string
  description: string | null
  current_milestone: string | null
  company_id: string | null
  requires_account_setup: boolean
  account_platform: string | null
  account_type: string | null
  expected_revenue_model: string | null
  expected_revenue_amount: number | null
  revenue_currency: string | null
  account_status: string
}

export type AccountSetupRow = {
  id: string
  platform_name: string | null
  platform_url: string | null
  account_type: string | null
  login_email: string | null
  status: string
  setup_notes: string | null
  required_documents: string[]
  missing_fields: string[]
  generated_application_text: string | null
  approval_required: boolean
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
}

export type RevenueRow = {
  id: string
  revenue_type: string | null
  expected_amount: number | null
  actual_amount: number | null
  currency: string
  commission_percentage: number | null
  payout_frequency: string | null
  payout_status: string | null
  first_payout_date: string | null
  last_payout_date: string | null
  notes: string | null
}

export default async function AccountSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await getActiveCompany()
  const supabase = await createClient()

  const { data: taskData } = await supabase
    .from('build_tracker')
    .select('id, name, description, current_milestone, company_id, requires_account_setup, account_platform, account_type, expected_revenue_model, expected_revenue_amount, revenue_currency, account_status')
    .eq('id', id)
    .maybeSingle()

  if (!taskData) notFound()
  const task = taskData as Task

  let companyName = company.name
  let profile: BusinessProfile | null = null
  if (task.company_id) {
    const [{ data: comp }, { data: prof }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', task.company_id).maybeSingle(),
      supabase
        .from('business_profiles')
        .select('legal_name, trade_name, kvk_number, vat_number, address, postal_code, city, country, website, contact_email, contact_phone, iban, business_description, short_pitch')
        .eq('company_id', task.company_id)
        .maybeSingle(),
    ])
    if (comp?.name) companyName = comp.name
    profile = (prof as BusinessProfile) ?? null
  }

  const { data: setupData } = await supabase
    .from('account_setups')
    .select('id, platform_name, platform_url, account_type, login_email, status, setup_notes, required_documents, missing_fields, generated_application_text, approval_required, submitted_at, approved_at, rejected_at')
    .eq('build_task_id', id)
    .maybeSingle()
  const setup = (setupData as AccountSetupRow) ?? null

  let revenues: RevenueRow[] = []
  if (setup) {
    const { data: rev } = await supabase
      .from('account_revenues')
      .select('id, revenue_type, expected_amount, actual_amount, currency, commission_percentage, payout_frequency, payout_status, first_payout_date, last_payout_date, notes')
      .eq('account_setup_id', setup.id)
      .order('created_at', { ascending: true })
    revenues = (rev as RevenueRow[]) ?? []
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/build-tracker/${id}`} className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <KeyRound size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white truncate">Account Setup Agent</h1>
          <p className="text-xs text-white/50 truncate">{task.name} — {companyName}</p>
        </div>
      </div>

      {/* Grenzen van de agent (mag NIET) */}
      <div className="bg-amber-500/[0.06] border border-amber-400/20 rounded-xl p-4 flex gap-3">
        <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-200/80 leading-relaxed">
          <span className="font-semibold text-amber-200">De agent bereidt alleen voor.</span> Hij omzeilt geen captcha
          of verificatie, vult geen nepgegevens in en verzendt nooit definitief zonder jouw handmatige goedkeuring.
          Ontbrekende gegevens worden exact als <span className="font-mono">&ldquo;nog invullen&rdquo;</span> getoond.
        </div>
      </div>

      <AccountSetupAgent
        task={{
          id: task.id,
          name: task.name,
          description: task.description,
          milestone: task.current_milestone,
          companyId: task.company_id,
          companyName,
          platform: task.account_platform,
          accountType: task.account_type,
          revenueModel: task.expected_revenue_model,
          revenueAmount: task.expected_revenue_amount,
          revenueCurrency: task.revenue_currency,
          accountStatus: task.account_status,
          requiresAccountSetup: task.requires_account_setup,
        }}
        profile={profile}
        setup={setup}
        revenues={revenues}
        companyColor={company.color}
      />
    </div>
  )
}
