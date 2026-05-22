"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const axios_1 = __importDefault(require("axios"));
const db = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:latest';
const USE_LM_STUDIO = process.env.USE_LM_STUDIO !== 'false';
const INTERVAL_MS = 15 * 60 * 1000;
const BATCH_SIZE = 10; // videos per run — verhoogd voor betere dekking
const FULL_AUDIT = process.argv.includes('--audit'); // npm run seo -- --audit
function log(msg) {
    console.log(`[${new Date().toLocaleTimeString('nl-NL')}] [seo] ${msg}`);
}
async function callAI(prompt) {
    if (USE_LM_STUDIO) {
        try {
            const res = await axios_1.default.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
                model: process.env.LM_STUDIO_MODEL || 'default',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 512,
            }, { timeout: 30_000 });
            return res.data.choices[0].message.content;
        }
        catch (err) {
            log(`⚠ LM_STUDIO connection failed, falling back to OLLAMA: ${err instanceof Error ? err.message : err}`);
        }
    }
    try {
        const res = await axios_1.default.post(`${OLLAMA_URL}/api/generate`, {
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
            options: { temperature: 0.7, num_predict: 512 },
        }, { timeout: 60_000 });
        return res.data.response;
    }
    catch (err) {
        throw new Error(`AI service unavailable (LM_STUDIO=${USE_LM_STUDIO}): ${err instanceof Error ? err.message : err}`);
    }
}
function buildPrompt(title, description, language) {
    const isNL = language === 'nl';
    return isNL ? `
Je bent een YouTube SEO expert. Maak de onderstaande titel en beschrijving scherper voor maximale CTR.

Huidige titel: "${title}"
Huidige beschrijving (eerste 200 tekens): "${description.slice(0, 200)}"

Regels voor de titel:
- Maximaal 70 tekens
- Voeg een getal toe als dat nog niet aanwezig is (bijv. "5 manieren", "€500")
- Voeg het jaar 2026 toe als dat zinvol is
- Maak het urgenter of nieuwsgieriger
- Behoud de kern van het onderwerp

Geef ALLEEN geldige JSON terug (geen markdown):
{"title":"nieuwe titel hier","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"]}
` : `
You are a YouTube SEO expert. Improve the title and generate tags for maximum CTR.

Current title: "${title}"
Current description (first 200 chars): "${description.slice(0, 200)}"

Rules for the title:
- Maximum 70 characters
- Include a number if not already present (e.g. "5 steps", "£500")
- Include year 2026 if relevant
- Make it more urgent or curiosity-driven
- Keep the core topic

Return ONLY valid JSON (no markdown):
{"title":"new title here","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"]}
`;
}
async function optimizeVideo(video) {
    try {
        const { data: channel } = await db
            .from('youtube_channels')
            .select('language')
            .eq('id', video.channel_id)
            .single();
        const language = channel?.language ?? 'nl';
        const prompt = buildPrompt(video.title, video.description ?? '', language);
        let raw;
        try {
            raw = await callAI(prompt);
        }
        catch (err) {
            log(`✗ AI fout voor ${video.id}: ${err.message}`);
            return;
        }
        const stripped = raw.replace(/```(?:json)?/g, '').replace(/```/g, '');
        const jsonMatch = stripped.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            log(`✗ Geen JSON voor ${video.id}`);
            return;
        }
        let result;
        try {
            result = JSON.parse(jsonMatch[0]);
        }
        catch (err) {
            log(`✗ JSON parse fout voor ${video.id}: ${err instanceof Error ? err.message : err}`);
            return;
        }
        if (!result.title || result.title.length > 100)
            return;
        if (result.title === video.title)
            return; // geen verbetering
        await db.from('youtube_videos').update({
            title: result.title,
            tags: result.tags ?? [],
            updated_at: new Date().toISOString(),
        }).eq('id', video.id);
        log(`✓ SEO: "${video.title.slice(0, 40)}" → "${result.title.slice(0, 40)}"`);
    }
    catch (err) {
        log(`✗ Fout bij optimizeVideo(${video.id}): ${err.message}`);
        throw err;
    }
}
async function runOptimizer() {
    try {
        let query = db
            .from('youtube_videos')
            .select('id, title, description, channel_id, status')
            .is('seo_optimized_at', null)
            .order('created_at', { ascending: true })
            .limit(BATCH_SIZE);
        if (!FULL_AUDIT) {
            // Normale modus: alleen video's die nog niet gepubliceerd zijn
            query = query.in('status', ['queued', 'planned', 'scheduled']);
        }
        // --audit modus: alle video's zonder seo_optimized_at, inclusief live
        const { data: videos, error } = await query;
        if (error) {
            log(`✗ Database fout bij video fetch: ${error.message}`);
            throw error;
        }
        if (!videos?.length) {
            if (FULL_AUDIT)
                log('Audit klaar — alle video\'s geoptimaliseerd');
            return;
        }
        log(`${videos.length} videos te optimaliseren${FULL_AUDIT ? ' (audit modus)' : ''}`);
        for (const video of videos) {
            try {
                await optimizeVideo(video);
                await db.from('youtube_videos')
                    .update({ seo_optimized_at: new Date().toISOString() })
                    .eq('id', video.id);
            }
            catch (videoErr) {
                log(`✗ Fout bij verwerking van video ${video.id}: ${videoErr.message}`);
                // Continue with next video instead of failing entire batch
            }
        }
    }
    catch (err) {
        log(`✗ Fout in runOptimizer: ${err.message}`);
        throw err;
    }
}
async function runFullAudit() {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('  SEO Full Audit — alle kanalen');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const { data: channels } = await db
        .from('youtube_channels')
        .select('id, naam')
        .order('naam');
    if (!channels?.length) {
        log('Geen kanalen gevonden');
        return;
    }
    for (const ch of channels) {
        const { count } = await db
            .from('youtube_videos')
            .select('id', { count: 'exact', head: true })
            .eq('channel_id', ch.id)
            .is('seo_optimized_at', null);
        log(`${ch.naam}: ${count ?? 0} videos wachten op SEO`);
    }
    log('Start batch optimalisatie...');
    let totalDone = 0;
    let hasMore = true;
    while (hasMore) {
        const { data: batch } = await db
            .from('youtube_videos')
            .select('id, title, description, channel_id, status')
            .is('seo_optimized_at', null)
            .order('created_at', { ascending: true })
            .limit(BATCH_SIZE);
        if (!batch?.length) {
            hasMore = false;
            break;
        }
        for (const video of batch) {
            await optimizeVideo(video);
            await db.from('youtube_videos')
                .update({ seo_optimized_at: new Date().toISOString() })
                .eq('id', video.id);
            totalDone++;
        }
        log(`${totalDone} videos afgerond...`);
    }
    log(`SEO audit voltooid — ${totalDone} videos geoptimaliseerd`);
}
async function main() {
    if (FULL_AUDIT) {
        await runFullAudit();
        process.exit(0);
    }
    log('SEO Optimizer gestart — interval: 15m');
    try {
        await runOptimizer();
    }
    catch (err) {
        log(`✗ Eerste run fout: ${err.message}`);
    }
    setInterval(async () => {
        try {
            await runOptimizer();
        }
        catch (err) {
            log(`✗ Scheduled run fout: ${err.message}`);
        }
    }, INTERVAL_MS);
}
main().catch(err => {
    console.error('[seo] Fatal:', err.message);
    process.exit(1);
});
