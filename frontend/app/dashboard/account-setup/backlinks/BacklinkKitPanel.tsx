'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  SUBMISSION_PROFILE, DESC_SHORT_EN, DESC_SHORT_NL, DESC_MEDIUM_EN, DESC_MEDIUM_NL,
  DESC_LONG_EN, DESC_LONG_NL, CATEGORY_TIPS,
} from '@/lib/backlinks/submission-kit';

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch {} }}
      className="shrink-0 text-white/35 hover:text-white/80" title="Kopieer" aria-label="Kopieer"
    >
      {done ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  );
}

function CopyRow({ label, value, sensitive }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="w-40 shrink-0 text-[10px] uppercase tracking-wide text-white/35">{label}</span>
      <span className={`flex-1 text-[11px] break-words ${sensitive ? 'text-amber-300/80 font-mono' : 'text-white/80'}`}>{value}</span>
      <CopyBtn text={value} />
    </div>
  );
}

function Block({ label, en, nl }: { label: string; en: string; nl: string }) {
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-white/35">{label} — EN</span>
        <CopyBtn text={en} />
      </div>
      <p className="text-[11px] text-white/70 leading-relaxed">{en}</p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[10px] uppercase tracking-wide text-white/35">{label} — NL</span>
        <CopyBtn text={nl} />
      </div>
      <p className="text-[11px] text-white/70 leading-relaxed">{nl}</p>
    </div>
  );
}

export function BacklinkKitPanel() {
  return (
    <details className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
      <summary className="text-[12px] font-semibold text-white/85 cursor-pointer select-none">
        📋 Submission-kit — invul-klare copy (klik om uit te vouwen)
      </summary>
      <div className="mt-3 border-t border-white/[0.06] pt-3">
        {SUBMISSION_PROFILE.map(f => <CopyRow key={f.label} label={f.label} value={f.value} sensitive={f.sensitive} />)}
        <Block label="Korte omschrijving (≤60)" en={DESC_SHORT_EN} nl={DESC_SHORT_NL} />
        <Block label="Medium (≤160)" en={DESC_MEDIUM_EN} nl={DESC_MEDIUM_NL} />
        <Block label="Lange omschrijving" en={DESC_LONG_EN} nl={DESC_LONG_NL} />
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-white/35">Tips per categorie</span>
          {CATEGORY_TIPS.map(t => (
            <p key={t.key} className="text-[10.5px] text-white/55">
              <span className="text-white/75 font-medium">{t.label}:</span> {t.tip}
            </p>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-amber-300/70">⚠️ Geel = nog invullen (logo-bestand + X/LinkedIn-handle).</p>
      </div>
    </details>
  );
}
