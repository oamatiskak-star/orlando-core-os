import { ShieldCheck, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { AccountStatusBadge } from '@/lib/affiliate-programs/badges'
import { updateProgramKeys, addDocument, setDocStatus } from '../actions'
import {
  DOC_KIND_LABEL, DOC_STATUS_LABEL, LOGIN_STATUS_LABEL,
  type AffiliateProgramRow, type AccountDocumentRow, type DocKind, type LoginStatus, type DocStatus,
} from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LOGIN_OPTIONS: LoginStatus[] = ['none', 'created', 'verified', 'mfa_pending', 'locked']
const DOC_KIND_OPTIONS: DocKind[] = ['kyc_id', 'proof_address', 'tax_form', 'contract', 'bank', 'other']
const DOC_STATUS_OPTIONS: DocStatus[] = ['required', 'uploaded', 'verified', 'rejected']

const DOC_STATUS_STYLE: Record<DocStatus, string> = {
  required: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
  uploaded: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10',
  verified: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
  rejected: 'text-red-300 border-red-400/30 bg-red-500/10',
}

type Prog = Pick<AffiliateProgramRow,
  'id' | 'name' | 'account_status' | 'login_status' | 'kyc_requirements' | 'referral_code' | 'affiliate_link' | 'notes'>

export default async function KycPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  let progQuery = supabase
    .from('affiliate_programs')
    .select('id, name, account_status, login_status, kyc_requirements, referral_code, affiliate_link, notes')
  progQuery = companyId ? progQuery.or(`company_id.eq.${companyId},company_id.is.null`) : progQuery.is('company_id', null)
  const { data: progData } = await progQuery.order('account_status', { ascending: true }).order('name')
  const programs: Prog[] = (progData ?? []) as Prog[]
  const programIds = programs.map(p => p.id)

  const { data: docData } = programIds.length
    ? await supabase
        .from('account_setup_documents')
        .select('id, program_id, doc_kind, storage_path, status, notes, created_at, updated_at')
        .in('program_id', programIds)
        .order('created_at', { ascending: true })
    : { data: [] }
  const docs: AccountDocumentRow[] = (docData ?? []) as AccountDocumentRow[]
  const docsByProgram = new Map<string, AccountDocumentRow[]>()
  for (const d of docs) {
    const arr = docsByProgram.get(d.program_id) ?? []
    arr.push(d)
    docsByProgram.set(d.program_id, arr)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-white/50">
        <KeyRound size={13} className="text-white/40" />
        <span>API-keys, referral-codes en logingegevens worden per programma in <span className="text-white/70">Notities</span> bewaard (authenticated-only, RLS-beveiligd).</span>
      </div>

      {programs.length === 0 ? (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] py-10 text-center">
          <ShieldCheck size={22} className="text-white/15 mx-auto mb-2" />
          <p className="text-[11px] text-white/40">Geen programma&apos;s in scope.</p>
        </div>
      ) : (
        programs.map((p) => {
          const pdocs = docsByProgram.get(p.id) ?? []
          const requiredOpen = pdocs.filter(d => d.status === 'required' || d.status === 'rejected').length
          return (
            <details key={p.id} className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-3">
              <summary className="flex items-center gap-2 cursor-pointer select-none list-none">
                <span className="text-[12px] text-white/90 font-medium flex-1">{p.name}</span>
                <AccountStatusBadge status={p.account_status} size="xs" />
                <span className="text-[10px] text-white/45">{LOGIN_STATUS_LABEL[p.login_status]}</span>
                <span className="text-[10px] text-white/40 tabular-nums">{pdocs.length} doc{pdocs.length === 1 ? '' : 's'}</span>
                {requiredOpen > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-400/30 bg-amber-500/10 text-amber-300">{requiredOpen} open</span>}
              </summary>

              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Keys / credentials / notes */}
                <form action={updateProgramKeys} className="space-y-2">
                  <input type="hidden" name="program_id" value={p.id} />
                  <div className="text-[10px] uppercase tracking-wide text-white/35">Keys &amp; credentials</div>
                  <input name="affiliate_link" defaultValue={p.affiliate_link ?? ''} placeholder="Affiliate link" className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 placeholder:text-white/30" />
                  <input name="referral_code" defaultValue={p.referral_code ?? ''} placeholder="Referral code" className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 placeholder:text-white/30" />
                  <select name="login_status" defaultValue={p.login_status} className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85">
                    {LOGIN_OPTIONS.map(s => <option key={s} value={s}>{LOGIN_STATUS_LABEL[s]}</option>)}
                  </select>
                  <textarea name="notes" defaultValue={p.notes ?? ''} rows={4} placeholder="Notities — API-keys, login, secrets…" className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 placeholder:text-white/30 font-mono" />
                  <button type="submit" className="px-2.5 py-1.5 text-[11px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/80">Opslaan</button>
                </form>

                {/* Documenten */}
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wide text-white/35">KYC / documenten</div>
                  {p.kyc_requirements && <p className="text-[10.5px] text-white/50 leading-snug">{p.kyc_requirements}</p>}
                  {pdocs.length === 0 ? (
                    <p className="text-[10.5px] text-white/35">Nog geen documenten geregistreerd.</p>
                  ) : (
                    <div className="space-y-1">
                      {pdocs.map(d => (
                        <div key={d.id} className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.05] rounded px-2 py-1.5">
                          <span className="text-[11px] text-white/80 flex-1">{DOC_KIND_LABEL[d.doc_kind]}</span>
                          <form action={setDocStatus} className="flex items-center gap-1">
                            <input type="hidden" name="document_id" value={d.id} />
                            <select name="status" defaultValue={d.status} className={`border rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${DOC_STATUS_STYLE[d.status]}`}>
                              {DOC_STATUS_OPTIONS.map(s => <option key={s} value={s}>{DOC_STATUS_LABEL[s]}</option>)}
                            </select>
                            <button type="submit" className="px-1.5 py-0.5 text-[9px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/70">Set</button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                  <form action={addDocument} className="flex items-center gap-1.5">
                    <input type="hidden" name="program_id" value={p.id} />
                    <select name="doc_kind" defaultValue="kyc_id" className="bg-white/[0.04] border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/80">
                      {DOC_KIND_OPTIONS.map(k => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}
                    </select>
                    <button type="submit" className="px-2 py-1 text-[10px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/75">+ Document</button>
                  </form>
                </div>
              </div>
            </details>
          )
        })
      )}
    </div>
  )
}
