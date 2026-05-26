type StreamEvent =
  | { kind: 'chunk'; text: string }
  | { kind: 'done'; analyse: string; strategieId: string | null }
  | { kind: 'error'; error: string }

export async function consumeAnalyseStream(
  res: Response,
  onEvent: (event: StreamEvent) => void
): Promise<{ analyse: string; strategieId: string | null }> {
  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`
    try {
      const text = await res.text()
      const parsed = JSON.parse(text) as { error?: string }
      if (parsed.error) message = parsed.error
    } catch {}
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalAnalyse = ''
  let finalStrategieId: string | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue

      const payload = JSON.parse(data)
      if (event === 'chunk') {
        finalAnalyse += payload.text
        onEvent({ kind: 'chunk', text: payload.text })
      } else if (event === 'done') {
        finalAnalyse = payload.analyse ?? finalAnalyse
        finalStrategieId = payload.strategieId ?? null
        onEvent({ kind: 'done', analyse: finalAnalyse, strategieId: finalStrategieId })
      } else if (event === 'error') {
        onEvent({ kind: 'error', error: payload.error })
        throw new Error(payload.error)
      }
    }
  }

  return { analyse: finalAnalyse, strategieId: finalStrategieId }
}
