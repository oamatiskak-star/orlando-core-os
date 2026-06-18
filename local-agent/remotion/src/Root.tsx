import React from 'react'
import { Composition } from 'remotion'
import { Explainer } from './Explainer'

const FPS = 30

// durationInFrames volgt de échte audiolengte (+1s outro) via calculateMetadata.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Explainer"
      // @ts-expect-error - props zijn dynamisch (JSON via --props)
      component={Explainer}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{
        title: 'Explainer',
        brand: '#0b1f3a',
        accent: '#C8102E',
        audioSrc: 'voice.mp3',
        audioDurationSec: 10,
        outro: '',
        captions: [],
        dataBeats: [],
      }}
      calculateMetadata={({ props }: any) => ({
        durationInFrames: Math.max(30, Math.round(((props.audioDurationSec || 10) + 1.2) * FPS)),
      })}
    />
  )
}
