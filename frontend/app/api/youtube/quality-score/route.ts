import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText } from 'ai'
import { claude } from '@/lib/ai/client'

export const runtime = 'nodejs'

type ScoreResult = {
  title_score:     number
  hook_score:      number
  thumbnail_score: number
  total_score:     number
  verdict:         'publish' | 'improve' | 'reject'
  feedback: {
    title:     string
    hook:      string
    thumbnail: string
  }
}

export async function POST(req: NextRequest) {
  const { queue_id, channel_id, title, hook, thumbnail_description } = await req.json()

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const prompt = `Je bent een expert YouTube-groeistrateg voor het Nederlandse financiële YouTube-netwerk.

Beoordeel deze video op 3 kwaliteitsdimensies. Geef ALLEEN geldige JSON terug, geen uitleg, geen markdown.

TITEL: "${title}"
HOOK (eerste 30 seconden script): "${hook ?? '(niet opgegeven)'}"
THUMBNAIL BESCHRIJVING: "${thumbnail_description ?? '(niet opgegeven)'}"

Scoringsregels:

TITLE (0-100):
+25 als het een concreet getal of naam bevat
+20 als er spanning/conflict in zit (bijv. "terwijl", "maar", "wat niemand ziet")
+20 als het "jij/jouw/je" bevat of direct persoonlijk is
+15 als het ≤70 tekens is
+20 als het een sterke trigger-emotie oproept (angst, hebzucht, verbazing, urgentie)
-20 als het begint met een generieke opener zoals "Hoe je..." zonder getal
-15 als het langer is dan 85 tekens

HOOK (0-100):
+30 als de eerste zin een shock stat bevat met een concreet eurobedrag of percentage
+25 als er een persoonlijk scenario in zit ("Stel je voor dat jij...")
+20 als er een open loop is ("Aan het einde van dit video leer je...")
+15 als de toon urgent en direct is
+10 als er een externe trigger is (nieuws, ECB, wet, marktbeweging)
-25 als de hook begint met kanaalintro of "welkom bij..."
-20 als er geen concreet getal in de eerste 15 seconden staat

THUMBNAIL (0-100):
+30 als het ≤3 visuele elementen heeft (tekst + gezicht + achtergrond)
+25 als de tekst leesbaar is op 5 meter afstand (grote letters, hoog contrast)
+25 als het een verrassing of bezorgdheid-expressie beschrijft
+20 als het een concreet eurobedrag of getal toont (niet een percentage)
-20 als de beschrijving druk of chaotisch klinkt (meer dan 4 elementen)
-15 als er geen emotie of expressie in zit

Bereken total_score als gewogen gemiddelde: (title*0.4 + hook*0.35 + thumbnail*0.25)
Verdeel:
- verdict "publish" als total ≥ 75
- verdict "improve" als total 50-74
- verdict "reject" als total < 50

{
  "title_score": <0-100>,
  "hook_score": <0-100>,
  "thumbnail_score": <0-100>,
  "total_score": <0-100>,
  "verdict": "publish|improve|reject",
  "feedback": {
    "title": "<concrete verbetersugestie in 1 zin, of 'Sterk' als score ≥80>",
    "hook": "<concrete verbetersugestie in 1 zin, of 'Sterk' als score ≥80>",
    "thumbnail": "<concrete verbetersugestie in 1 zin, of 'Sterk' als score ≥80>"
  }
}`

  try {
    const { text } = await generateText({
      model:           claude.sonnet,
      maxOutputTokens: 500,
      messages:        [{ role: 'user', content: prompt }],
    })

    const raw = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const result: ScoreResult = JSON.parse(raw)

    // Clamp scores
    result.title_score     = Math.min(100, Math.max(0, result.title_score     ?? 0))
    result.hook_score      = Math.min(100, Math.max(0, result.hook_score      ?? 0))
    result.thumbnail_score = Math.min(100, Math.max(0, result.thumbnail_score ?? 0))
    result.total_score     = Math.min(100, Math.max(0, result.total_score     ?? 0))

    const validVerdicts = ['publish', 'improve', 'reject'] as const
    if (!validVerdicts.includes(result.verdict as any)) {
      result.verdict = result.total_score >= 75 ? 'publish' : result.total_score >= 50 ? 'improve' : 'reject'
    }

    // Persist to DB if queue_id given
    if (queue_id) {
      const admin = createAdminClient()
      await admin.from('youtube_quality_scores').insert({
        queue_id,
        channel_id: channel_id ?? null,
        title_score:     result.title_score,
        hook_score:      result.hook_score,
        thumbnail_score: result.thumbnail_score,
        total_score:     result.total_score,
        verdict:         result.verdict,
        feedback:        result.feedback,
      })

      if (result.verdict === 'reject') {
        await admin.from('youtube_upload_queue').update({
          status:     'manual_review_required',
          last_error: `Kwaliteitsscore te laag: ${result.total_score}/100 — ${result.feedback.title}`,
          updated_at: new Date().toISOString(),
        }).eq('id', queue_id).in('status', ['queued', 'pending'])
      }
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[quality-score] fout:', err)
    return NextResponse.json({ error: 'Score kon niet worden berekend' }, { status: 500 })
  }
}
