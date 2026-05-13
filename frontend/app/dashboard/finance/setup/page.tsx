'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, ExternalLink, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

const SQL_MIGRATION = `-- Finance OS — Database Schema
-- Run this in Supabase SQL Editor

create table if not exists fin_customers (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  name text not null,
  kvk text,
  btw text,
  email text,
  phone text,
  address text,
  city text,
  score integer default 70,
  risk_level text default 'midden',
  payment_avg_days integer default 30,
  created_at timestamptz default now()
);

create table if not exists fin_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  customer_id uuid references fin_customers(id),
  invoice_nr text not null unique,
  description text,
  amount_excl numeric not null,
  vat_pct numeric default 21,
  amount_vat numeric not null,
  amount_incl numeric not null,
  amount_paid numeric default 0,
  issued_at date not null,
  due_date date not null,
  paid_at date,
  status text default 'open',
  days_overdue integer default 0,
  workflow_stage text default 'nieuw',
  created_at timestamptz default now()
);

create table if not exists fin_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references fin_invoices(id),
  amount numeric not null,
  method text default 'bank',
  reference text,
  paid_at date not null,
  created_at timestamptz default now()
);

create table if not exists fin_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references fin_invoices(id),
  type text not null,
  subject text,
  body text,
  sent_at timestamptz,
  opened_at timestamptz,
  stage text not null,
  created_at timestamptz default now()
);

create table if not exists fin_incasso_cases (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references fin_invoices(id),
  company_id text,
  status text default 'actief',
  amount_principal numeric not null,
  amount_interest numeric default 0,
  amount_costs numeric default 0,
  amount_total numeric not null,
  incasso_party text,
  started_at date not null,
  created_at timestamptz default now()
);

create table if not exists fin_legal_cases (
  id uuid primary key default gen_random_uuid(),
  incasso_case_id uuid references fin_incasso_cases(id),
  company_id text,
  status text default 'in_behandeling',
  lawyer text,
  case_nr text,
  amount_claimed numeric not null,
  started_at date not null,
  created_at timestamptz default now()
);

create table if not exists fin_timeline (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references fin_invoices(id),
  event_type text not null,
  title text not null,
  description text,
  amount numeric,
  performed_by text default 'Systeem',
  created_at timestamptz default now()
);

create table if not exists fin_workflow_rules (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  name text not null,
  trigger_type text not null,
  trigger_days integer,
  action_type text not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists fin_templates (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  name text not null,
  type text not null,
  stage text not null,
  subject text,
  body text not null,
  tone text default 'zakelijk',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists fin_company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id text not null unique,
  company_name text,
  kvk text,
  btw text,
  iban text,
  payment_terms integer default 30,
  incasso_days integer default 30,
  interest_rate numeric default 1.5,
  late_fee numeric default 40,
  tone_of_voice text default 'zakelijk',
  auto_reminder boolean default true,
  auto_incasso boolean default false,
  updated_at timestamptz default now()
);`

const TABLES = [
  'fin_customers',
  'fin_invoices',
  'fin_payments',
  'fin_reminders',
  'fin_incasso_cases',
  'fin_legal_cases',
  'fin_timeline',
  'fin_workflow_rules',
  'fin_templates',
  'fin_company_settings',
]

type TableStatus = 'ok' | 'missing' | 'checking'

export default function SetupPage() {
  const [copied, setCopied] = useState(false)
  const [tableStatuses, setTableStatuses] = useState<Record<string, TableStatus>>({})
  const [checking, setChecking] = useState(false)

  async function checkTables() {
    setChecking(true)
    const supabase = createClient()
    const statuses: Record<string, TableStatus> = {}

    await Promise.all(
      TABLES.map(async (table) => {
        try {
          const { error } = await supabase.from(table).select('id').limit(1)
          statuses[table] = error ? 'missing' : 'ok'
        } catch {
          statuses[table] = 'missing'
        }
      }),
    )

    setTableStatuses(statuses)
    setChecking(false)
  }

  useEffect(() => {
    checkTables()
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(SQL_MIGRATION)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allOk = TABLES.length > 0 && TABLES.every((t) => tableStatuses[t] === 'ok')

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Finance OS — Database Setup</h1>
        <p className="text-xs text-white/50 mt-0.5">
          Voer de onderstaande SQL uit in de Supabase SQL Editor om de Finance OS database tabellen aan te maken.
        </p>
      </div>

      {/* Status summary */}
      <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${allOk ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        {allOk ? (
          <>
            <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-400">Alle Finance OS tabellen zijn aanwezig en actief.</p>
          </>
        ) : (
          <>
            <XCircle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">
              Finance OS tabellen ontbreken. Voer de SQL migration uit om ze aan te maken.
            </p>
          </>
        )}
      </div>

      {/* Table status checklist */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-white">Database Status</h3>
          <button
            onClick={checkTables}
            disabled={checking}
            className="border border-white/10 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Controleren...' : 'Controleer Status'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TABLES.map((table) => {
            const status = tableStatuses[table] ?? 'checking'
            return (
              <div key={table} className="flex items-center gap-2 py-1.5">
                {status === 'ok' ? (
                  <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                ) : status === 'missing' ? (
                  <XCircle size={13} className="text-red-400 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin flex-shrink-0" />
                )}
                <span className={`text-xs font-mono ${status === 'ok' ? 'text-white/60' : status === 'missing' ? 'text-red-400/80' : 'text-white/50'}`}>
                  {table}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* SQL block */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-xs font-medium text-white/65">SQL Migration</span>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="border border-white/10 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Copy size={11} />
              {copied ? 'Gekopieerd!' : 'Kopieer SQL'}
            </button>
            <a
              href="https://supabase.com/dashboard/project/pmovazftwoxjopqkuuhp/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink size={11} />
              Open SQL Editor
            </a>
          </div>
        </div>
        <pre className="p-4 text-[11px] text-white/50 leading-relaxed overflow-x-auto max-h-96 font-mono">
          {SQL_MIGRATION}
        </pre>
      </div>
    </div>
  )
}
