import React from 'react'
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'

type Caption = { text: string; from: number; to: number } // seconden
type DataBeat = { value: string; label: string; from: number; to: number }
type Scene = { src: string; from: number; to: number; isVideo: boolean } // src = staticFile-naam
type Props = {
  title: string
  brand: string
  accent: string
  audioSrc: string
  audioDurationSec: number
  outro?: string
  captions: Caption[]
  dataBeats?: DataBeat[]
  scenes?: Scene[]
}

/** Achtergrondlaag: de gesourcete content (vastgoed/finance b-roll + charts) per scene-window,
 *  full-bleed met Ken-Burns op stills. Donkere overlay (apart) houdt captions leesbaar. */
const SceneBackground: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ backgroundColor: '#05080f' }}>
      {scenes.map((s, i) => {
        const fromF = Math.round(s.from * fps)
        const durF = Math.max(1, Math.round((s.to - s.from) * fps))
        return (
          <Sequence key={i} from={fromF} durationInFrames={durF} layout="none">
            {s.isVideo
              ? <OffthreadVideo src={staticFile(s.src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <KenBurns src={s.src} durF={durF} />}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

const KenBurns: React.FC<{ src: string; durF: number }> = ({ src, durF }) => {
  const frame = useCurrentFrame()
  const scale = interpolate(frame, [0, durF], [1.06, 1.14], { extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ overflow: 'hidden' }}>
    <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }} />
  </AbsoluteFill>
}

/** Zachte, bewegende achtergrond-gradient (brand-kleur) — geen statische stock, wel rustig. */
const Background: React.FC<{ brand: string; accent: string }> = ({ brand, accent }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const drift = Math.sin(frame / 90) * 0.5 + 0.5
  const cx = 30 + drift * 40
  return (
    <AbsoluteFill style={{ backgroundColor: brand }}>
      <AbsoluteFill style={{
        background: `radial-gradient(120% 120% at ${cx}% 18%, ${accent}33 0%, transparent 45%), radial-gradient(140% 140% at ${100 - cx}% 100%, #ffffff14 0%, transparent 50%)`,
      }} />
      {/* subtiel raster voor diepte */}
      <AbsoluteFill style={{
        backgroundImage: 'linear-gradient(#ffffff0a 1px, transparent 1px), linear-gradient(90deg, #ffffff0a 1px, transparent 1px)',
        backgroundSize: '64px 64px', opacity: 0.5, maskImage: 'radial-gradient(80% 80% at 50% 40%, #000 30%, transparent 75%)',
      }} />
    </AbsoluteFill>
  )
}

const TitleBar: React.FC<{ title: string; accent: string }> = ({ title, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const slide = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${interpolate(slide, [0, 1], [-90, 0])}px)` }}>
      <div style={{ background: '#0009', padding: '20px 44px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 14, height: 40, background: accent, borderRadius: 3 }} />
        <span style={{ color: '#fff', font: '700 38px Arial, sans-serif', letterSpacing: 0.3 }}>{title}</span>
      </div>
      <div style={{ height: 6, background: accent }} />
    </div>
  )
}

/** Lower-third kinetische caption: actieve cue, met inkomende animatie. */
const Captions: React.FC<{ captions: Caption[]; accent: string }> = ({ captions, accent }) => {
  const frame = useCurrentFrame()
  const { fps, height } = useVideoConfig()
  const t = frame / fps
  const active = captions.find((c) => t >= c.from && t < c.to)
  if (!active) return null
  const localFrame = Math.max(0, frame - Math.round(active.from * fps))
  const enter = spring({ frame: localFrame, fps, config: { damping: 200 }, durationInFrames: 8 })
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: Math.round(height / 8),
      display: 'flex', justifyContent: 'center',
      transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`, opacity: enter,
    }}>
      <div style={{ maxWidth: '78%', textAlign: 'center', background: '#000a', borderRadius: 14, padding: '16px 30px', borderBottom: `5px solid ${accent}` }}>
        <span style={{ color: '#fff', font: '700 50px Arial, sans-serif', lineHeight: 1.25 }}>{active.text}</span>
      </div>
    </div>
  )
}

/** Data-animatie: actieve stat met count-up van het getal-deel + scale-in. Boven de captions. */
const StatCards: React.FC<{ dataBeats: DataBeat[]; accent: string }> = ({ dataBeats, accent }) => {
  const frame = useCurrentFrame()
  const { fps, height } = useVideoConfig()
  const t = frame / fps
  const active = (dataBeats || []).find((d) => t >= d.from && t < d.to)
  if (!active) return null
  const localFrame = Math.max(0, frame - Math.round(active.from * fps))
  const enter = spring({ frame: localFrame, fps, config: { damping: 200 }, durationInFrames: 12 })
  // count-up van het eerste getal in value (bv. "34/100" → 34, "$2.1T" → 2.1, "<20%" → 20)
  const m = active.value.match(/-?\d+(?:[.,]\d+)?/)
  let display = active.value
  if (m) {
    const target = parseFloat(m[0].replace(',', '.'))
    const p = interpolate(localFrame, [0, Math.round(0.8 * fps)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const cur = target * p
    const shown = Number.isInteger(target) ? String(Math.round(cur)) : cur.toFixed(1)
    display = active.value.replace(m[0], shown)
  }
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: Math.round(height * 0.30),
      display: 'flex', justifyContent: 'center',
      transform: `scale(${interpolate(enter, [0, 1], [0.8, 1])})`, opacity: enter,
    }}>
      <div style={{ textAlign: 'center', background: '#0007', borderRadius: 22, padding: '34px 60px', border: `2px solid ${accent}66` }}>
        <div style={{ color: '#fff', font: '800 150px Arial, sans-serif', lineHeight: 1, textShadow: '0 4px 24px #0008' }}>{display}</div>
        <div style={{ color: accent, font: '700 40px Arial, sans-serif', marginTop: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{active.label}</div>
      </div>
    </div>
  )
}

const IntroCard: React.FC<{ title: string; accent: string }> = ({ title, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const introEnd = Math.round(1.1 * fps)
  if (frame > introEnd + 12) return null
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 })
  const out = interpolate(frame, [introEnd, introEnd + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})`, textAlign: 'center', opacity: s }}>
        <div style={{ width: 90, height: 8, background: accent, borderRadius: 4, margin: '0 auto 28px' }} />
        <span style={{ color: '#fff', font: '800 84px Arial, sans-serif', maxWidth: 1400, display: 'inline-block', lineHeight: 1.1 }}>{title}</span>
      </div>
    </AbsoluteFill>
  )
}

const OutroCard: React.FC<{ outro: string; accent: string }> = ({ outro, accent }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const start = durationInFrames - Math.round(1.2 * fps)
  if (frame < start || !outro) return null
  const s = spring({ frame: frame - start, fps, config: { damping: 200 }, durationInFrames: 14 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', background: '#000c', opacity: s }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 70, height: 8, background: accent, borderRadius: 4, margin: '0 auto 24px' }} />
        <span style={{ color: '#fff', font: '800 64px Arial, sans-serif', maxWidth: 1300, display: 'inline-block' }}>{outro}</span>
      </div>
    </AbsoluteFill>
  )
}

export const Explainer: React.FC<Props> = ({ title, brand, accent, audioSrc, outro, captions, dataBeats, scenes }) => {
  const hasScenes = Array.isArray(scenes) && scenes.length > 0
  return (
    <AbsoluteFill>
      {hasScenes ? <SceneBackground scenes={scenes!} /> : <Background brand={brand} accent={accent} />}
      {/* leesbaarheids-overlay over de content-achtergrond */}
      {hasScenes && <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0008 0%, #0002 35%, #0007 100%)' }} />}
      <Audio src={staticFile(audioSrc)} />
      <TitleBar title={title} accent={accent} />
      <StatCards dataBeats={dataBeats || []} accent={accent} />
      <Captions captions={captions || []} accent={accent} />
      <IntroCard title={title} accent={accent} />
      <OutroCard outro={outro || ''} accent={accent} />
    </AbsoluteFill>
  )
}
