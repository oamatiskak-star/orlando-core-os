'use client'

import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'

type Model = 'sonnet' | 'opus' | 'haiku'

export function useOrlandoAI(model: Model = 'sonnet') {
  return useChat({
    transport: new TextStreamChatTransport({
      api: '/api/ai/chat',
      body: { model },
    }),
  })
}
