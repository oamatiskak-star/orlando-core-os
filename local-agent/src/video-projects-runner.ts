import './ws-shim'   // MOET eerst — zet global WebSocket vóór elke @supabase-import
import 'dotenv/config'

/**
 * VIDEO-PROJECTS RUNNER (Content Factory 2.0) — thin CLI-entry.
 *
 * Twee modi:
 *  --dry-run : topic → content → scenes (alleen ai + scene-planner). GEEN DB,
 *              GEEN @supabase-client, GEEN env/service_role, GEEN assets/render/QC.
 *              Bewijst alleen de generatie-helft. Dit is GEEN CF2 PASS.
 *  --shadow  : volledige record-producerende keten (shadow-core). Draait EERST
 *              preflight; BLOCKED_* → stop, geen DB-writes. Schrijft CF2-records
 *              (queue_id NULL, approved false, 0 upload_queue-inserts).
 *
 * De DB-modules (shadow-core/preflight) worden UITSLUITEND dynamisch geïmporteerd
 * in het --shadow-pad, zodat --dry-run nooit een Supabase-client initialiseert.
 */

if (require.main === module) {
  const arg = (k: string, d: string): string => {
    const i = process.argv.indexOf(`--${k}`)
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
  }
  const flag = (k: string): boolean => process.argv.includes(`--${k}`)

  const topic = arg('topic', '')
  if (!topic) {
    console.error('Gebruik: [--dry-run | --shadow] --topic "..." [--niche ..] [--lang nl|en|es] [--format 16:9|9:16|1:1] [--seconds 60]')
    process.exit(1)
  }

  const common = {
    topic,
    niche:         arg('niche', 'vastgoed'),
    language:      arg('lang', 'nl'),
    format:        arg('format', '16:9') as '16:9' | '9:16' | '1:1',
    targetSeconds: Number(arg('seconds', '60')),
    lmStudioModel: process.env.LM_STUDIO_MODEL || 'default',
    ollamaModel:   process.env.OLLAMA_MODEL || 'llama3.2',
  }

  if (flag('dry-run')) {
    // GEEN supabase-import: laadt alleen ai + scene-planner.
    import('./dry-run-core')
      .then(({ runDryRun }) => runDryRun(common))
      .then((r) => {
        console.log('DRY-RUN-RESULT:', JSON.stringify(r, null, 2))
        process.exit(r.validation_status === 'valid' ? 0 : 1)
      })
      .catch((e) => { console.error('DRY-RUN-FOUT:', e?.message ?? e); process.exit(1) })
  } else {
    // --shadow: preflight EERST; pas bij PASS de DB-keten dynamisch laden.
    import('./preflight')
      .then(({ runPreflight }) => runPreflight())
      .then((pf) => {
        if (!pf.ok) {
          console.log('PREFLIGHT:', JSON.stringify(pf, null, 2))
          console.error(`SHADOW-RUN GEBLOKKEERD (preflight): ${pf.blocked.join(', ')} — geen records geproduceerd, geen fakes.`)
          process.exit(2)
        }
        return import('./shadow-core').then(({ runShadowTopic }) =>
          runShadowTopic({ channelId: null, voice: arg('voice', 'nl-NL-ColetteNeural'), ...common }),
        ).then((r) => { console.log('SHADOW-RESULT:', JSON.stringify(r, null, 2)); process.exit(0) })
      })
      .catch((e) => { console.error('SHADOW-FOUT:', e?.message ?? e); process.exit(1) })
  }
}
