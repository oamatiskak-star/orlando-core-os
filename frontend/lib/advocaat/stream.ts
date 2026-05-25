export type AnalyseEvent =
  | { kind: 'chunk'; text: string }
  | { kind: 'done'; strategieId: string | null; analyse: string }
  | { kind: 'error'; error: string }

export type AnalyseFinal = {
  strategieId: string | null
  analyse: string
}

export async function consumeAnalyseStream(
  res: Response,
  onEvent: (event: AnalyseEvent) => void,
): Promise<AnalyseFinal> {
  if (!res.ok || !res.body) {
    const message = !res.body
      ? `Geen response stream (status ${res.status})`
      : `HTTP ${res.status}`
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let final: AnalyseFinal = { strategieId: null, analyse: '' }
  let errorMessage: string | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      let eventName = 'message'
      const dataLines: string[] = []
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''))
        }
      }
      if (dataLines.length === 0) continue

      let payload: unknown
      try {
        payload = JSON.parse(dataLines.join('\n'))
      } catch {
        continue
      }

      if (eventName === 'chunk') {
        const text = (payload as { text?: unknown })?.text
        if (typeof text === 'string') onEvent({ kind: 'chunk', text })
      } else if (eventName === 'done') {
        const p = payload as { strategieId?: unknown; analyse?: unknown }
        final = {
          strategieId: typeof p.strategieId === 'string' ? p.strategieId : null,
          analyse: typeof p.analyse === 'string' ? p.analyse : '',
        }
        onEvent({ kind: 'done', strategieId: final.strategieId, analyse: final.analyse })
      } else if (eventName === 'error') {
        const err = (payload as { error?: unknown })?.error
        errorMessage = typeof err === 'string' ? err : 'Onbekende streamfout'
        onEvent({ kind: 'error', error: errorMessage })
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage)
  return final
}
