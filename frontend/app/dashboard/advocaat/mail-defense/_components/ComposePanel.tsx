'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, Loader2, Copy, Check, Paperclip, FileText } from 'lucide-react'
import type { MailDefenseItem, ComposeResult, SuggestedDoc } from '@/lib/advocaat/types'

interface Props {
  item: MailDefenseItem
  dossiers: { id: string; title: string }[]
  onBack: () => void
  onSaved: (updated: MailDefenseItem) => void
}

type Tone = 'zakelijk' | 'formeel' | 'stellig' | 'vriendelijk'

const TONES: { value: Tone; label: string }[] = [
  { value: 'zakelijk', label: 'Zakelijk' },
  { value: 'formeel', label: 'Formeel' },
  { value: 'stellig', label: 'Stellig' },
  { value: 'vriendelijk', label: 'Vriendelijk' },
]

function extractConfidence(draft: string): number | null {
  const lines = draft.split('\n').slice(-10).join('\n')
  const match = lines.match(/(\d{1,3})%/)
  return match ? parseInt(match[1], 10) : null
}

export function ComposePanel({ item, dossiers, onBack, onSaved }: Props) {
  const [bodyText, setBodyText] = useState(item.body_text ?? '')
  const [dossierId, setDossierId] = useState(item.dossier_id ?? '')
  const [tone, setTone] = useState<Tone>('zakelijk')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComposeResult | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (item.ai_draft) {
      setResult({
        draft: item.ai_draft,
        suggested_doc_ids: item.suggested_doc_ids ?? [],
        suggested_docs: [],
        memories_used: 0,
        docs_searched: 0,
        keywords_found: [],
      })
    }
  }, [item.ai_draft, item.suggested_doc_ids])

  async function handleCompose() {
    if (!bodyText.trim()) { setError('Voeg de mail tekst in'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/advocaat/mail-defense/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mail_id: item.id,
          body_text: bodyText,
          subject: item.subject,
          from_address: item.from_address,
          from_name: item.from_name,
          dossier_id: dossierId || undefined,
          tone,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fout'); return }
      setResult(data)
      onSaved({ ...item, body_text: bodyText, ai_draft: data.draft, dossier_id: dossierId || item.dossier_id })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result.draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confidence = result ? extractConfidence(result.draft) : null

  return (
    <div className="flex flex-col gap-6 min-h-0">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-0.5 p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-white">AI Antwoord samenstellen</h2>
          <p className="text-xs text-white/40">
            Concept op basis van geheugen + bewijsarchief — nooit automatisch verzonden
          </p>
        </div>
      </div>

      {/* Form — hidden once result is shown */}
      {!result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: mail tekst */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-white/60">
                Mail tekst <span className="text-white/30">(plak hier de inkomende mail)</span>
              </label>
              <textarea
                rows={10}
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                placeholder="Plak de inkomende mail hier..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg p-3 text-sm text-white font-mono resize-none focus:outline-none focus:border-orange-500/40 placeholder:text-white/20 transition-colors"
              />
            </div>

            {/* Right: instellingen */}
            <div className="flex flex-col gap-4">
              {/* Dossier */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/60">
                  Koppel aan dossier <span className="text-white/30">(optioneel)</span>
                </label>
                <select
                  value={dossierId}
                  onChange={e => setDossierId(e.target.value)}
                  className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-orange-500/40 transition-colors"
                >
                  <option value="">(Geen dossier)</option>
                  {dossiers.map(d => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>

              {/* Tone */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/60">Toon</label>
                <div className="grid grid-cols-2 gap-2">
                  {TONES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        tone === t.value
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                          : 'bg-white/[0.03] border-white/[0.07] text-white/50 hover:text-white/70 hover:bg-white/[0.05]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning card */}
              <div className="mt-auto flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <span className="text-xs font-bold text-red-400 tracking-wide uppercase bg-red-500/20 rounded px-1.5 py-0.5">
                  CONCEPT ONLY
                </span>
                <span className="text-xs text-red-300/70">Nooit automatisch verzonden</span>
              </div>
            </div>
          </div>

          {/* Compose button */}
          <button
            onClick={handleCompose}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Samenstellen met AI...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Stel AI Antwoord op
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-red-400 mt-1">{error}</p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-5">
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-medium rounded-full px-3 py-1">
              Geheugen: {result.memories_used} items
            </span>
            <span className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium rounded-full px-3 py-1">
              Documenten: {result.docs_searched} gevonden
            </span>
            {result.keywords_found.length > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] text-white/40 text-xs rounded-full px-3 py-1">
                Keywords: {result.keywords_found.join(', ')}
              </span>
            )}
            {confidence !== null && (
              <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-xs font-bold rounded-full px-3 py-1">
                {confidence}% confidence
              </span>
            )}
          </div>

          {/* Draft */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/60">Concept antwoord</label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.07]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Gekopieerd</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Kopieer
                  </>
                )}
              </button>
            </div>
            <textarea
              readOnly
              value={result.draft}
              rows={14}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 text-sm text-white/80 font-mono resize-none focus:outline-none focus:border-orange-500/20 transition-colors"
            />
          </div>

          {/* Suggested docs */}
          {result.suggested_docs.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-white/40" />
                <span className="text-xs font-medium text-white/60">
                  Aanbevolen bijlagen ({result.suggested_docs.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.suggested_docs.map((doc: SuggestedDoc) => (
                  <div
                    key={doc.id}
                    className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-2.5 flex items-start gap-2"
                  >
                    <FileText className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs font-medium text-white truncate">{doc.title}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-white/40">{doc.document_type}</span>
                        {doc.is_evidence && (
                          <span className="text-[10px] font-bold tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 rounded px-1.5 py-0.5 uppercase">
                            Bewijs
                          </span>
                        )}
                        <span className="text-[10px] bg-white/[0.05] text-white/40 rounded px-1.5 py-0.5">
                          {doc.content_label}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nieuw concept button */}
          <button
            onClick={() => setResult(null)}
            className="self-start flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06]"
          >
            <Zap className="w-3.5 h-3.5" />
            Nieuw concept
          </button>
        </div>
      )}
    </div>
  )
}
