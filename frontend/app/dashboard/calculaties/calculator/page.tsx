'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calculator, ChevronDown, ChevronRight, Plus, Trash2,
  Printer, ArrowLeft, Pencil, Check, Copy, ChevronUp,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  id: string
  omschrijving: string
  hoeveelheid: string
  eenheid: string
  eenheidsprijs: string
}

interface Hoofdstuk {
  id: string
  naam: string
  posten: Post[]
  open: boolean
}

// ─── Pre-built combis (2Jours-stijl) ─────────────────────────────────────────

const COMBIS: Record<string, Omit<Post, 'id'>[]> = {
  Sloopwerk: [
    { omschrijving: 'Sloop bestaande vloer (inclusief afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00' },
    { omschrijving: 'Sloop binnenwanden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00' },
    { omschrijving: 'Sloop dakbeschot / pannen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Afvoer puin (container)', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '65.00' },
  ],
  Fundering: [
    { omschrijving: 'Grondwerk / ontgraving', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '28.00' },
    { omschrijving: 'Betonnen strookfundering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00' },
    { omschrijving: 'Onderstopsel bestaande fundering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '280.00' },
    { omschrijving: 'Kruipruimte drainage', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '45.00' },
  ],
  Metselwerk: [
    { omschrijving: 'Binnenwand metselwerk 10 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Buitengevel metselwerk 21 cm (spouw)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '165.00' },
    { omschrijving: 'Borstwering / latei metselwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '120.00' },
    { omschrijving: 'Schoorsteenkanaal metselwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '320.00' },
  ],
  Tegelwerk: [
    { omschrijving: 'Wandtegels badkamer (incl. tegellijm en voeg)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00' },
    { omschrijving: 'Vloertegels badkamer / toilet', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00' },
    { omschrijving: 'Vloertegels keuken / woonkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00' },
    { omschrijving: 'Tegelplint (5 cm)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '28.00' },
  ],
  Stucwerk: [
    { omschrijving: 'Glad stucwerk wanden (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Glad stucwerk plafond', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'Buitengevel spachtelputz', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00' },
    { omschrijving: 'Cementdekvloer (egaline)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '35.00' },
  ],
  Schilderwerk: [
    { omschrijving: 'Binnenwanden schilderwerk (2 lagen)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00' },
    { omschrijving: 'Plafonds schilderwerk', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '15.00' },
    { omschrijving: 'Kozijnen buiten schilderwerk', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00' },
    { omschrijving: 'Deuren schilderwerk (2 zijden)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00' },
  ],
  Elektra: [
    { omschrijving: 'Groep (incl. leiding, buis, aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00' },
    { omschrijving: 'Wandcontactdoos enkel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '85.00' },
    { omschrijving: 'Wandcontactdoos dubbel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '115.00' },
    { omschrijving: 'LED-inbouwarmatuur', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00' },
    { omschrijving: 'Meterkast vernieuwen (16-groepen)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1250.00' },
  ],
  Loodgieterij: [
    { omschrijving: 'Aansluitpunt warm- en koudwaterleiding', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00' },
    { omschrijving: 'Inloopdouche compleet (incl. kraan)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00' },
    { omschrijving: 'Toilet compleet (incl. reservoir en zitting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '680.00' },
    { omschrijving: 'Wastafel incl. kraan en sifon', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '520.00' },
    { omschrijving: 'Radiator aansluiten (incl. thermostaatknop)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00' },
    { omschrijving: 'Vloerverwarming (incl. verdeler)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '55.00' },
  ],
  'Kozijnen & Deuren': [
    { omschrijving: 'Kunststof raamkozijn HR++ glas', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1200.00' },
    { omschrijving: 'Voordeur compleet (incl. hang- en sluitwerk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2800.00' },
    { omschrijving: 'Binnendeur (incl. kozijn, hang- en sluitwerk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '480.00' },
    { omschrijving: 'Schuifpui 2-delig aluminium', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3500.00' },
  ],
  Vloerwerk: [
    { omschrijving: 'Laminaatvloer leggen (incl. ondervloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'PVC-vloer leggen (incl. ondervloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '32.00' },
    { omschrijving: 'Parketvloer leggen (incl. schuren en lakken)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00' },
    { omschrijving: 'Houten vloer schuren en lakken (bestaand)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
  ],
  Dakwerk: [
    { omschrijving: 'Dakpannen vervangen (incl. tengels)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Bitumen dakbedekking plat dak', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00' },
    { omschrijving: 'Dakgoot vervangen (zink)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00' },
    { omschrijving: 'Dakrenovatie inclusief ondervloer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00' },
  ],
  Isolatie: [
    { omschrijving: 'Spouwmuurisolatie (ingeblazen)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'Dakisolatie (PIR 12 cm)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00' },
    { omschrijving: 'Vloerisolatie (EPS onder dekvloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '35.00' },
    { omschrijving: 'Gevelisolatie buitenzijde (composiet)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '120.00' },
  ],
}

const EENHEDEN = ['m²', 'm³', 'm¹', 'st', 'uur', 'dag', 'ls', 'kg', 'ton', 'set']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 9)

function legePost(): Post {
  return { id: genId(), omschrijving: '', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '' }
}

function parseNum(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0
}

function postTotaal(p: Post): number {
  return parseNum(p.hoeveelheid) * parseNum(p.eenheidsprijs)
}

function hoofdstukTotaal(h: Hoofdstuk): number {
  return h.posten.reduce((s, p) => s + postTotaal(p), 0)
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtNum(n: number): string {
  if (n === 0) return '—'
  return new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ─── Inline edit input ────────────────────────────────────────────────────────

function InlineInput({
  value, onChange, placeholder, className, align = 'left', type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(
        'bg-transparent focus:outline-none focus:bg-white/5 rounded px-1 -mx-1 w-full text-xs text-white placeholder:text-white/20 transition-colors',
        align === 'right' && 'text-right',
        className,
      )}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const router = useRouter()

  const [projectNaam, setProjectNaam] = useState('Nieuwe calculatie')
  const [editingNaam, setEditingNaam] = useState(false)
  const [projectNummer, setProjectNummer] = useState(
    `CAL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`
  )
  const [klant, setKlant] = useState('')
  const [datum] = useState(
    new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  )
  const [hoofdstukken, setHoofdstukken] = useState<Hoofdstuk[]>([
    {
      id: genId(),
      naam: 'Hoofdstuk 1',
      open: true,
      posten: [legePost()],
    },
  ])
  const [opslag, setOpslag] = useState('10')
  const [btwPct, setBtwPct] = useState('21')
  const [combiMenuFor, setCombiMenuFor] = useState<string | null>(null)
  const combiRef = useRef<HTMLDivElement>(null)

  // Close combi menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (combiRef.current && !combiRef.current.contains(e.target as Node)) {
        setCombiMenuFor(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Totals ──
  const subtotaal = hoofdstukken.reduce((s, h) => s + hoofdstukTotaal(h), 0)
  const opslagBedrag = subtotaal * (parseNum(opslag) / 100)
  const exclBtw = subtotaal + opslagBedrag
  const btwBedrag = exclBtw * (parseNum(btwPct) / 100)
  const totaalInclBtw = exclBtw + btwBedrag

  // ── Hoofdstuk handlers ──
  const addHoofdstuk = () =>
    setHoofdstukken(prev => [
      ...prev,
      { id: genId(), naam: `Hoofdstuk ${prev.length + 1}`, open: true, posten: [legePost()] },
    ])

  const removeHoofdstuk = (hId: string) =>
    setHoofdstukken(prev => prev.filter(h => h.id !== hId))

  const updateHoofdstuk = (hId: string, patch: Partial<Hoofdstuk>) =>
    setHoofdstukken(prev => prev.map(h => h.id === hId ? { ...h, ...patch } : h))

  const moveHoofdstuk = (hId: string, dir: -1 | 1) =>
    setHoofdstukken(prev => {
      const idx = prev.findIndex(h => h.id === hId)
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })

  // ── Post handlers ──
  const addPost = (hId: string) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId ? { ...h, posten: [...h.posten, legePost()] } : h
    ))

  const removePost = (hId: string, pId: string) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId ? { ...h, posten: h.posten.filter(p => p.id !== pId) } : h
    ))

  const updatePost = (hId: string, pId: string, patch: Partial<Post>) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId
        ? { ...h, posten: h.posten.map(p => p.id === pId ? { ...p, ...patch } : p) }
        : h
    ))

  // ── Combi insert ──
  const insertCombi = (hId: string, naam: string) => {
    const posten = COMBIS[naam].map(c => ({ id: genId(), ...c }))
    updateHoofdstuk(hId, { naam, posten })
    setCombiMenuFor(null)
  }

  // ── Duplicate chapter ──
  const duplicateHoofdstuk = (h: Hoofdstuk) =>
    setHoofdstukken(prev => {
      const idx = prev.findIndex(x => x.id === h.id)
      const copy: Hoofdstuk = {
        ...h,
        id: genId(),
        naam: `${h.naam} (kopie)`,
        posten: h.posten.map(p => ({ ...p, id: genId() })),
      }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })

  return (
    <div className="space-y-4 pb-12 print:pb-0">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/calculaties')}
            className="text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Calculator size={16} className="text-orange-400" />
          </div>
          <div>
            {editingNaam ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={projectNaam}
                  onChange={e => setProjectNaam(e.target.value)}
                  onBlur={() => setEditingNaam(false)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingNaam(false) }}
                  className="bg-white/10 border border-white/20 text-white text-sm font-semibold px-2 py-0.5 rounded focus:outline-none"
                />
                <button onClick={() => setEditingNaam(false)} className="text-green-400">
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingNaam(true)}
                className="flex items-center gap-1.5 group"
              >
                <h1 className="text-base font-semibold text-white group-hover:text-white/80 transition-colors">
                  {projectNaam}
                </h1>
                <Pencil size={11} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            )}
            <p className="text-xs text-white/40">{projectNummer} · {datum}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Printer size={12} />
            Afdrukken
          </button>
        </div>
      </div>

      {/* ── Print header (only visible when printing) ── */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">{projectNaam}</h1>
        <p className="text-sm text-gray-500">{projectNummer} · {datum}{klant ? ` · ${klant}` : ''}</p>
      </div>

      {/* ── Meta row ── */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <div className="bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Projectnummer</p>
          <InlineInput value={projectNummer} onChange={setProjectNummer} placeholder="CAL-2025-001" />
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Klant / opdrachtgever</p>
          <InlineInput value={klant} onChange={setKlant} placeholder="Naam opdrachtgever..." />
        </div>
      </div>

      {/* ── Chapters ── */}
      <div className="space-y-3">
        {hoofdstukken.map((h, hIdx) => {
          const htotaal = hoofdstukTotaal(h)
          return (
            <div
              key={h.id}
              className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden print:border print:border-gray-200 print:rounded-none print:mb-4"
            >
              {/* Chapter header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 print:border-b print:border-gray-200 group/hdr">
                <button
                  onClick={() => updateHoofdstuk(h.id, { open: !h.open })}
                  className="text-white/40 hover:text-white transition-colors print:hidden"
                >
                  {h.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className="text-[11px] text-white/30 font-mono w-6 print:text-black">{hIdx + 1}.</span>
                <InlineInput
                  value={h.naam}
                  onChange={v => updateHoofdstuk(h.id, { naam: v })}
                  className="font-semibold text-sm print:text-black"
                />
                {htotaal > 0 && (
                  <span className="text-xs font-semibold text-white/70 ml-auto whitespace-nowrap print:text-black">
                    {fmtEur(htotaal)}
                  </span>
                )}

                {/* Combi button */}
                <div className="relative print:hidden" ref={combiMenuFor === h.id ? combiRef : undefined}>
                  <button
                    onClick={() => setCombiMenuFor(combiMenuFor === h.id ? null : h.id)}
                    className={clsx(
                      'text-[10px] border px-2 py-1 rounded transition-all',
                      combiMenuFor === h.id
                        ? 'text-indigo-300 border-indigo-500/50 bg-indigo-500/10'
                        : 'text-indigo-400/60 border-indigo-500/20 opacity-0 group-hover/hdr:opacity-100 hover:text-indigo-300 hover:border-indigo-500/50',
                    )}
                  >
                    Combi invoegen
                  </button>
                  {combiMenuFor === h.id && (
                    <div className="absolute right-0 top-9 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl min-w-52 py-1.5 overflow-hidden">
                      <p className="text-[9px] text-white/30 uppercase tracking-wider px-3 pt-1 pb-1.5">
                        Standaard combis
                      </p>
                      {Object.keys(COMBIS).map(c => (
                        <button
                          key={c}
                          onClick={() => insertCombi(h.id, c)}
                          className="w-full text-left px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chapter actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/hdr:opacity-100 transition-opacity print:hidden">
                  <button
                    onClick={() => moveHoofdstuk(h.id, -1)}
                    className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    title="Omhoog"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveHoofdstuk(h.id, 1)}
                    className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    title="Omlaag"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={() => duplicateHoofdstuk(h)}
                    className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    title="Dupliceren"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => removeHoofdstuk(h.id)}
                    className="p-1 text-white/20 hover:text-red-400 transition-colors"
                    title="Verwijderen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Posts */}
              {h.open && (
                <>
                  {/* Column headers */}
                  <div className="grid items-center gap-2 px-4 py-2 text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.03] print:text-gray-400 print:border-gray-100"
                    style={{ gridTemplateColumns: '1fr 72px 68px 100px 90px 24px' }}
                  >
                    <span>Omschrijving</span>
                    <span className="text-right">Hoeveelheid</span>
                    <span className="pl-1">Eenheid</span>
                    <span className="text-right">Prijs / eenheid</span>
                    <span className="text-right">Totaal</span>
                    <span />
                  </div>

                  {h.posten.map((p, pIdx) => {
                    const pt = postTotaal(p)
                    return (
                      <div
                        key={p.id}
                        className="grid items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group/post print:border-b print:border-gray-50"
                        style={{ gridTemplateColumns: '1fr 72px 68px 100px 90px 24px' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/20 font-mono w-4 shrink-0 print:text-gray-400">
                            {hIdx + 1}.{pIdx + 1}
                          </span>
                          <InlineInput
                            value={p.omschrijving}
                            onChange={v => updatePost(h.id, p.id, { omschrijving: v })}
                            placeholder="Omschrijving werk..."
                          />
                        </div>
                        <InlineInput
                          value={p.hoeveelheid}
                          onChange={v => updatePost(h.id, p.id, { hoeveelheid: v })}
                          placeholder="0"
                          align="right"
                        />
                        <select
                          value={p.eenheid}
                          onChange={e => updatePost(h.id, p.id, { eenheid: e.target.value })}
                          className="bg-transparent text-xs text-white/50 focus:outline-none focus:text-white transition-colors pl-1 print:text-black"
                        >
                          {EENHEDEN.map(e => (
                            <option key={e} value={e} className="bg-zinc-900 text-white">{e}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-0.5 justify-end">
                          <span className="text-xs text-white/30 print:hidden">€</span>
                          <InlineInput
                            value={p.eenheidsprijs}
                            onChange={v => updatePost(h.id, p.id, { eenheidsprijs: v })}
                            placeholder="0,00"
                            align="right"
                          />
                        </div>
                        <span className={clsx(
                          'text-xs text-right tabular-nums',
                          pt > 0 ? 'text-white/80 print:text-black' : 'text-white/20',
                        )}>
                          {pt > 0 ? fmtEur(pt) : '—'}
                        </span>
                        <button
                          onClick={() => removePost(h.id, p.id)}
                          className="text-white/15 hover:text-red-400 opacity-0 group-hover/post:opacity-100 transition-all print:hidden"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )
                  })}

                  {/* Add post row */}
                  <button
                    onClick={() => addPost(h.id)}
                    className="flex items-center gap-2 px-4 py-2 text-[11px] text-white/25 hover:text-white/60 transition-colors w-full print:hidden"
                  >
                    <Plus size={11} />
                    Regel toevoegen
                  </button>
                </>
              )}
            </div>
          )
        })}

        {/* Add chapter */}
        <button
          onClick={addHoofdstuk}
          className="flex items-center justify-center gap-2 border border-dashed border-white/10 hover:border-indigo-500/40 hover:text-indigo-400 text-white/30 text-xs font-medium px-4 py-3 rounded-xl transition-all w-full print:hidden"
        >
          <Plus size={13} />
          Hoofdstuk toevoegen
        </button>
      </div>

      {/* ── Totaaloverzicht ── */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 print:border print:border-gray-200">
        <h2 className="text-sm font-semibold text-white mb-4 print:text-black">Totaaloverzicht</h2>

        {/* Per-chapter breakdown */}
        <div className="space-y-1 mb-4">
          {hoofdstukken.map((h, i) => {
            const ht = hoofdstukTotaal(h)
            if (ht === 0) return null
            return (
              <div key={h.id} className="flex justify-between text-xs text-white/50 print:text-black">
                <span className="font-mono text-white/30 print:text-gray-400 mr-2">{i + 1}.</span>
                <span className="flex-1">{h.naam}</span>
                <span className="tabular-nums">{fmtEur(ht)}</span>
              </div>
            )
          })}
        </div>

        {/* Calculations */}
        <div className="border-t border-white/10 pt-4 space-y-2 print:border-gray-200">
          <div className="flex justify-between text-xs text-white/60 print:text-black">
            <span>Subtotaal (excl. opslag en BTW)</span>
            <span className="tabular-nums font-medium">{fmtEur(subtotaal)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-white/60 print:hidden">
            <div className="flex items-center gap-2">
              <span>Opslag</span>
              <input
                value={opslag}
                onChange={e => setOpslag(e.target.value)}
                className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-center text-xs focus:outline-none focus:border-white/25"
              />
              <span className="text-white/40">%</span>
            </div>
            <span className="tabular-nums">{fmtEur(opslagBedrag)}</span>
          </div>
          <div className="flex justify-between text-xs text-white/60 print:flex hidden">
            <span>Opslag ({opslag}%)</span>
            <span className="tabular-nums">{fmtEur(opslagBedrag)}</span>
          </div>

          <div className="flex justify-between text-xs text-white/70 border-t border-white/5 pt-2 print:border-gray-100 print:text-black">
            <span>Subtotaal excl. BTW</span>
            <span className="tabular-nums font-medium">{fmtEur(exclBtw)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-white/60 print:hidden">
            <div className="flex items-center gap-2">
              <span>BTW</span>
              <input
                value={btwPct}
                onChange={e => setBtwPct(e.target.value)}
                className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-center text-xs focus:outline-none focus:border-white/25"
              />
              <span className="text-white/40">%</span>
            </div>
            <span className="tabular-nums">{fmtEur(btwBedrag)}</span>
          </div>
          <div className="flex justify-between text-xs text-white/60 print:flex hidden">
            <span>BTW ({btwPct}%)</span>
            <span className="tabular-nums">{fmtEur(btwBedrag)}</span>
          </div>

          <div className="flex justify-between border-t border-white/10 pt-3 print:border-gray-300">
            <span className="text-sm font-bold text-white print:text-black">Totaal incl. BTW</span>
            <span className="text-sm font-bold text-white tabular-nums print:text-black">
              {fmtEur(totaalInclBtw)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          nav, aside, [data-sidebar], header { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:flex { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
