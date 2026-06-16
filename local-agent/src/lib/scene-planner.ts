import axios from 'axios'

/**
 * SCENE-PLANNER (Content Factory 2.0 — FASE 2).
 *
 * Verdeelt een gegenereerd script in scenes voor de Automated Visual Production
 * Engine. Spiegelt exact het LLM-transport van `ai.ts` (LM Studio primair →
 * Ollama fallback, zelfde env-vars, zelfde strip-en-parse), zodat er geen nieuw
 * model-pad ontstaat. Output mapt 1:1 op de kolommen van `public.video_scenes`
 * (migratie 153). Geen API-key of host-keuze nodig — puur lokale LLM.
 */

const USE_LM_STUDIO   = process.env.USE_LM_STUDIO !== 'false'
const LM_STUDIO_URL   = process.env.LM_STUDIO_URL   || 'http://localhost:1234'
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'default'
const OLLAMA_URL      = process.env.OLLAMA_URL      || 'http://localhost:11434'
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'llama3.2'

/** Eén scene — velden komen exact overeen met public.video_scenes. */
export interface SceneSpec {
  idx:               number
  voice_text:        string
  visual_intent:     string
  search_query:      string
  shot_type:         string
  emotion:           string
  pacing:            string
  music_intensity:   string
  caption_text:      string
  expected_duration: number
}

export interface PlanScenesInput {
  full_script:    string
  title:          string
  language:       string            // 'nl' | 'en' | 'es'
  format:         '16:9' | '9:16' | '1:1'
  target_seconds: number
  niche?:         string | null     // CF2 Scene-Query V2 — niche-verankering (gated)
  lm_studio_model?: string
  ollama_model?:    string
}

/**
 * CF2 Scene-Query V2 (GATED: CF2_SCENE_QUERY_V2=1, default uit → bestaand gedrag).
 * Dwingt CONCRETE, filmbare, niche-verankerde stock-zoektermen af i.p.v. generieke
 * "person doing X". Upstream-fix voor lage topic_relevance (CF2.9-bevinding).
 */
function searchQueryInstruction(niche: string | null | undefined): string {
  if (process.env.CF2_SCENE_QUERY_V2 !== '1') {
    return 'English stock-video search term (2-5 words) for this scene'
  }
  return `CONCRETE filmable stock-footage subject in ENGLISH (2-5 words). Name the actual visual SUBJECT + setting${niche ? ` for the niche "${niche}"` : ''} — NOT a generic action. ` +
    `Prefer specific objects/places/scenes over "person doing X". ` +
    `GOOD: "stock market trading floor", "modern apartment interior", "construction crane skyline", "server room data center", "gold bars vault". ` +
    `BAD (never use): "person standing", "someone thinking", "man looking", "thing happening", "intro screen"`
}

async function callLMStudio(prompt: string, model: string): Promise<string> {
  const res = await axios.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 4096,
  }, { timeout: 120_000 })
  return res.data.choices[0].message.content as string
}

async function callOllama(prompt: string, model: string): Promise<string> {
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model,
    prompt,
    stream: false,
    format: 'json',
    options: { temperature: 0.6, num_predict: 8192, num_ctx: 8192 },
  }, { timeout: 300_000 })
  return res.data.response as string
}

function buildPrompt(input: PlanScenesInput, sceneCount: number, secPerScene: number): string {
  const isNl = input.language === 'nl'
  const langName = input.language === 'nl' ? 'Nederlands' : input.language === 'es' ? 'Spaans' : 'Engels'
  const orientation = input.format === '9:16' ? 'verticaal (Shorts/Reels)' : input.format === '1:1' ? 'vierkant' : 'horizontaal (YouTube)'
  const sqInstr = searchQueryInstruction(input.niche)

  if (isNl) {
    return `Je bent een documentaire-regisseur die scripts opdeelt in cinematische scenes voor "${input.title}".
Verdeel het onderstaande script in PRECIES ${sceneCount} scenes (formaat: ${orientation}).
Elke scene duurt circa ${secPerScene} seconden.

Geef UITSLUITEND één JSON-object terug met sleutel "scenes" = array. Elke scene:
{
  "voice_text": "de exacte voice-over zin(nen) voor deze scene (in het Nederlands)",
  "visual_intent": "wat we zien — concreet, cinematisch",
  "search_query": "${sqInstr}",
  "shot_type": "bv 'slow cinematic pan', 'aerial drone', 'close-up'",
  "emotion": "bv 'curiosity', 'tension', 'authority'",
  "pacing": "slow | medium | fast",
  "music_intensity": "low | building | high",
  "caption_text": "korte on-screen tekst (max 6 woorden)",
  "expected_duration": ${secPerScene}
}

SCRIPT:
${input.full_script}`
  }

  return `You are a documentary director splitting a script into cinematic scenes for "${input.title}".
Split the script below into EXACTLY ${sceneCount} scenes (orientation: ${orientation}).
Each scene lasts about ${secPerScene} seconds.

Return ONLY one JSON object with key "scenes" = array. Each scene:
{
  "voice_text": "the exact voice-over sentence(s) for this scene (in ${langName})",
  "visual_intent": "what we see — concrete, cinematic",
  "search_query": "${sqInstr}",
  "shot_type": "e.g. 'slow cinematic pan', 'aerial drone', 'close-up'",
  "emotion": "e.g. 'curiosity', 'tension', 'authority'",
  "pacing": "slow | medium | fast",
  "music_intensity": "low | building | high",
  "caption_text": "short on-screen text (max 6 words)",
  "expected_duration": ${secPerScene}
}

SCRIPT:
${input.full_script}`
}

/** Haal het eerste JSON-object uit een LLM-respons (markdown-tolerant). */
function extractJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('scene-planner: geen JSON in LLM-respons')
  return JSON.parse(match[0])
}

/**
 * CF2 Scene-Query V2 — deterministische concretisering (gated). Stock-search matcht
 * de LEIDENDE term; het 8B-model levert vaak "person ... with <onderwerp>" waarbij de
 * concrete context achteraan verloren gaat. Deze transform leidt de query met het
 * concrete onderwerp en kapt expressie-/lengte-ruis. Geen onderwerp → query blijft gelijk.
 */
const Q_MODIFIER = /^(calm|bright|happy|serious|dark|soft|warm|cold|good|nice|beautiful|big|small|colou?rful|blurry|clear|sad|angry|neutral|positive|negative)\b/i
const Q_TRAIL = /\s+(with|and|of|in|on|at|the|a|an|to|for)$/i
function concretizeQuery(q: string): string {
  if (process.env.CF2_SCENE_QUERY_V2 !== '1') return q
  let s = (q || '').trim()
  // 1) strip trailing emotie/expressie/actie-ruis ("... and happy expression", "... and waving goodbye")
  s = s.replace(/\s+and\s+.*$/i, '').trim()
  s = s.replace(/\b(serious|satisfied|happy|grateful|concerned|calm|worried|neutral|excited|focused)\s+expression\b/gi, '').trim()
  // 2) "person ... with <onderwerp>" → leid met <onderwerp>, MAAR alleen als het een concreet
  //    onderwerp is (geen modifier-adjectief zoals "calm background") — anders onderwerp behouden
  const m = s.match(/^(?:a |the )?(?:person|man|woman|someone|people|guy|girl|individual)\b.*?\bwith\b\s+(.+)$/i)
  if (m && m[1] && !Q_MODIFIER.test(m[1].trim())) s = m[1].trim()
  // 3) opschonen + kap op 5 woorden (stock matcht kort+concreet het best)
  s = s.replace(/\s{2,}/g, ' ').replace(/[,.;:]+$/, '').replace(Q_TRAIL, '').trim()
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length > 5) s = words.slice(0, 5).join(' ').replace(Q_TRAIL, '').trim()
  return s.length >= 3 ? s : (q || '').trim()
}

function clampScene(s: any, idx: number, fallbackDuration: number): SceneSpec {
  const str = (v: unknown, d = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : d)
  const dur = Number(s?.expected_duration)
  return {
    idx,
    voice_text:        str(s?.voice_text),
    visual_intent:     str(s?.visual_intent),
    search_query:      concretizeQuery(str(s?.search_query, str(s?.visual_intent))),
    shot_type:         str(s?.shot_type, 'cinematic'),
    emotion:           str(s?.emotion, 'neutral'),
    pacing:            str(s?.pacing, 'medium'),
    music_intensity:   str(s?.music_intensity, 'building'),
    caption_text:      str(s?.caption_text),
    expected_duration: Number.isFinite(dur) && dur > 0 ? dur : fallbackDuration,
  }
}

/**
 * Plant scenes voor een video. Bepaalt zelf een passend aantal scenes op basis
 * van de doelduur (≈ 1 scene per 5s, min 3, max 40) en valt bij parse-fouten
 * terug op Ollama (zoals ai.ts). Gooit alleen als beide modellen falen.
 */
// Deterministische scene-split: garandeert geldige scenes uit het script wanneer een (zwak)
// lokaal model geen bruikbare JSON levert. Geen verzonnen content — splitst de échte narratie;
// data-beat scenes worden in chart-intelligence alsnog door FMP-charts overschreven.
function buildDeterministicScenes(input: PlanScenesInput, sceneCount: number, secPerScene: number): SceneSpec[] {
  const sentences = (input.full_script || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [input.full_script || input.title]
  const per = Math.max(1, Math.ceil(sentences.length / sceneCount))
  const QUERIES = ['stock market chart', 'wall street trading floor', 'financial data screen', 'stock ticker board',
    'finance newspaper closeup', 'city financial district skyline', 'rising investment graph', 'economic dashboard data']
  const scenes: SceneSpec[] = []
  for (let i = 0; i < sentences.length && scenes.length < sceneCount; i += per) {
    const chunk = sentences.slice(i, i + per).join(' ').trim()
    if (!chunk) continue
    const q = QUERIES[scenes.length % QUERIES.length]
    scenes.push({
      idx: scenes.length + 1, voice_text: chunk, visual_intent: q, search_query: q,
      shot_type: 'b-roll', emotion: 'neutral', pacing: 'medium', music_intensity: 'low',
      caption_text: chunk.split(/\s+/).slice(0, 6).join(' '), expected_duration: secPerScene,
    })
  }
  if (scenes.length === 0) {
    scenes.push({ idx: 1, voice_text: input.title || 'Finance update', visual_intent: QUERIES[0], search_query: QUERIES[0],
      shot_type: 'b-roll', emotion: 'neutral', pacing: 'medium', music_intensity: 'low',
      caption_text: (input.title || 'Finance').split(/\s+/).slice(0, 6).join(' '), expected_duration: secPerScene })
  }
  return scenes
}

export async function planScenes(input: PlanScenesInput): Promise<SceneSpec[]> {
  const secPerScene = input.format === '9:16' ? 4 : 5
  // Long-form (16:9 data-explainer) heeft meer scenes nodig dan de Shorts-cap van 40
  // (40×5s = max 200s). Shorts (9:16) blijven ongewijzigd op cap 40.
  const maxScenes = input.format === '9:16' ? 40 : 150
  const sceneCount = Math.min(maxScenes, Math.max(3, Math.round(input.target_seconds / secPerScene)))
  const prompt = buildPrompt(input, sceneCount, secPerScene)

  const lmModel = input.lm_studio_model || LM_STUDIO_MODEL
  const olModel = input.ollama_model    || OLLAMA_MODEL

  let raw: string
  try {
    raw = USE_LM_STUDIO ? await callLMStudio(prompt, lmModel) : await callOllama(prompt, olModel)
  } catch {
    // Spiegelt ai.ts: bij falen van de primaire backend → de andere proberen.
    raw = USE_LM_STUDIO ? await callOllama(prompt, olModel) : await callLMStudio(prompt, lmModel)
  }

  let parsed: any
  try {
    parsed = extractJson(raw)
  } catch {
    // Eén harde retry op de fallback-backend met dezelfde prompt.
    const retryRaw = USE_LM_STUDIO ? await callOllama(prompt, olModel) : await callLMStudio(prompt, lmModel)
    parsed = extractJson(retryRaw)
  }

  const arr: any[] = Array.isArray(parsed?.scenes) ? parsed.scenes : Array.isArray(parsed) ? parsed : []
  const planned = arr.map((s, i) => clampScene(s, i + 1, secPerScene)).filter((s) => s.voice_text.length > 0)
  if (planned.length > 0) return planned

  // Zwak/leeg LLM-resultaat → deterministische split i.p.v. hard falen (long-form-veilig).
  console.warn(`scene-planner: LLM gaf ${arr.length} scenes (0 bruikbaar) → deterministische script-split`)
  return buildDeterministicScenes(input, sceneCount, secPerScene)
}
