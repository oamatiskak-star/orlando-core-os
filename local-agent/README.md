# Orlando Local Agent

Draait op je eigen machine. Polt elke 30 seconden `agent_tasks` in Supabase en voert content-productietaken uit:

1. Script genereren via LM Studio of Ollama
2. TTS audio via edge-tts (nl-NL-ColetteNeural)
3. Video assembleren met FFmpeg
4. Uploaden naar Supabase Storage → registreert in `youtube_videos` (status='queued')

De youtube-engine pakt het daarna op voor upload naar YouTube.

## Vereisten

- Node.js 18+
- FFmpeg (`brew install ffmpeg`)
- Python 3 + edge-tts (`pip install edge-tts`)
- LM Studio of Ollama lokaal draaien

## Setup

```bash
cd local-agent
npm install
cp .env.example .env
# Vul SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in
```

## Starten

```bash
npm run dev        # TypeScript direct (ontwikkeling)
npm run build && npm start   # Gecompileerde versie
```

## Environment variabelen

| Variabele | Standaard | Uitleg |
|-----------|-----------|--------|
| `SUPABASE_URL` | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Service role key (niet de anon key) |
| `USE_LM_STUDIO` | `true` | `false` = gebruik Ollama als primair |
| `LM_STUDIO_URL` | `http://localhost:1234` | LM Studio OpenAI-compatibele endpoint |
| `LM_STUDIO_MODEL` | `default` | Model naam in LM Studio |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama URL |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model naam |
| `VIDEO_OUTPUT_DIR` | `/tmp/orlando-videos` | Tijdelijk opslagpad voor video's |
| `POLL_INTERVAL_SECONDS` | `30` | Poll interval in seconden |

## Hoe het werkt

De nightly pipeline cron (02:00 via Vercel) maakt `agent_tasks` aan in Supabase.
De local-agent pikt deze taken op, produceert de video en plaatst hem in de upload-queue.
De youtube-engine op Render uploadt vervolgens naar YouTube op het geplande tijdstip.

Na succesvolle upload (status='verified_live') ruimt de file-cleanup-worker automatisch
de bestanden op uit Supabase Storage en het lokale bestandssysteem.
