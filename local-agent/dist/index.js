"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ai_1 = require("./lib/ai");
const tts_1 = require("./lib/tts");
const video_1 = require("./lib/video");
const storage_1 = require("./lib/storage");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_SECONDS ?? '30') * 1000;
const OUTPUT_DIR = process.env.VIDEO_OUTPUT_DIR ?? '/tmp/orlando-videos';
const db = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});
fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
function log(msg, ...args) {
    console.log(`[${new Date().toLocaleTimeString('nl-NL')}] ${msg}`, ...args);
}
async function processTask(task) {
    const p = task.payload;
    log(`Taak oppakken: ${p.channel_name} | ${p.video_type} | "${p.topic}"`);
    // Markeer als in behandeling
    await db.from('agent_tasks').update({
        status: 'running',
        started_at: new Date().toISOString(),
    }).eq('id', task.id);
    // Worker registry — markeer als busy
    await db.from('worker_registry').update({
        status: 'busy',
        current_task_id: task.id,
        current_task_description: `${p.channel_name} — ${p.topic?.slice(0, 70)}`,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('id', process.env.WORKER_ID ?? 'W1');
    const tmpDir = path_1.default.join(OUTPUT_DIR, task.id);
    fs_1.default.mkdirSync(tmpDir, { recursive: true });
    try {
        // ── Stap 1: Genereer content via lokale AI ──────────────────
        log('Stap 1/4: Script genereren via AI...');
        const content = await (0, ai_1.generateContent)({
            channel_name: p.channel_name,
            topic: p.topic,
            video_type: p.video_type,
            language: p.language ?? 'nl',
            style: p.style ?? 'energiek, informatief',
            target_seconds: p.target_seconds ?? 300,
            ollama_model: p.ollama_model ?? 'llama3.2',
            lm_studio_model: p.lm_studio_model ?? 'default',
        });
        // Sla content op in calendar
        await db.from('yt_content_calendar').update({
            title: content.title,
            description: content.description,
            seo_title: content.title,
            seo_description: content.description,
            seo_tags: content.tags,
            full_script: content.full_script,
            hook_script: content.hook,
            thumbnail_concept: content.thumbnail_concept,
            cta: content.cta,
            status: 'script_ready',
            updated_at: new Date().toISOString(),
        }).eq('id', p.calendar_id);
        // ── Stap 2: Genereer TTS audio ──────────────────────────────
        log('Stap 2/4: TTS audio genereren...');
        const audioPath = path_1.default.join(tmpDir, 'audio.mp3');
        await (0, tts_1.generateTTS)(content.full_script, audioPath, p.voice ?? 'nl-NL-ColetteNeural');
        // ── Stap 3: Assembleer video ─────────────────────────────────
        log('Stap 3/4: Video assembleren met FFmpeg...');
        const videoFilename = `${p.channel_name}_${p.video_type}_${Date.now()}.mp4`;
        const videoPath = path_1.default.join(tmpDir, videoFilename);
        await (0, video_1.buildVideo)({
            audioPath,
            outputPath: videoPath,
            title: content.title,
            bgColor: p.bg_color ?? '#1a1a2e',
            isShort: p.video_type === 'short',
        });
        // ── Stap 4: Upload naar Supabase Storage ─────────────────────
        log('Stap 4/4: Uploaden naar Supabase Storage...');
        const storagePath = `${p.channel_name}/${p.publish_date}/${videoFilename}`;
        const signedUrl = await (0, storage_1.uploadVideoToStorage)(videoPath, storagePath);
        // Registreer video in youtube_videos
        const { data: video, error: videoInsertError } = await db.from('youtube_videos').insert({
            channel_id: p.channel_id,
            video_id: `pending_${Date.now()}`,
            title: content.title,
            description: content.description,
            tags: content.tags,
            category_id: '22',
            privacy_status: 'private',
            file_path: signedUrl,
            storage_bucket: 'yt-videos',
            storage_path: storagePath,
            status: 'queued',
            upload_status: 'pending',
            is_short: p.video_type === 'short',
        }).select('id').single();
        if (!video?.id)
            throw new Error(`youtube_videos insert mislukt: ${videoInsertError?.message ?? 'geen data'}`);
        // Koppel aan calendar
        await db.from('yt_content_calendar').update({
            youtube_video_id: video.id,
            storage_path: storagePath,
            status: 'video_ready',
            updated_at: new Date().toISOString(),
        }).eq('id', p.calendar_id);
        // Registreer in generated_media voor Mission Control file tracking
        await db.from('generated_media').insert({
            channel_id: p.channel_id,
            channel_name: p.channel_name,
            title: content.title,
            topic: p.topic,
            video_type: p.video_type,
            audio_path: audioPath,
            video_path: storagePath,
            storage_provider: 'supabase',
            storage_bucket: 'yt-videos',
            storage_path: storagePath,
            storage_url: signedUrl,
            local_worker: process.env.WORKER_ID ?? 'W1',
            render_status: 'complete',
            upload_status: 'pending',
            verification_status: 'pending',
            agent_task_id: task.id,
            calendar_id: p.calendar_id,
            publish_date: p.publish_date,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        // Worker registry — markeer worker als idle na taak
        await db.from('worker_registry').update({
            status: 'online',
            current_task_id: null,
            current_task_description: null,
            updated_at: new Date().toISOString(),
        }).eq('id', process.env.WORKER_ID ?? 'W1');
        // Taak afronden
        await db.from('agent_tasks').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: {
                video_id: video.id,
                storage_path: storagePath,
                title: content.title,
            },
        }).eq('id', task.id);
        // Audit log
        await db.from('media_audit_log').insert({
            action: 'render_complete',
            status: 'success',
            channel_id: p.channel_id,
            worker_id: process.env.WORKER_ID ?? 'W1',
            message: `"${content.title}" gegenereerd en geüpload naar ${storagePath}`,
            metadata: { storage_path: storagePath, video_id: video.id },
        });
        log(`✓ Klaar: "${content.title}" → ${storagePath}`);
        // Lokale bestanden opruimen (video al in storage)
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
    catch (err) {
        log(`✗ Fout bij taak ${task.id}:`, err.message);
        await db.from('agent_tasks').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: err.message,
        }).eq('id', task.id);
        await db.from('yt_content_calendar').update({
            status: 'failed',
            error_message: err.message,
            updated_at: new Date().toISOString(),
        }).eq('id', task.payload?.calendar_id);
        // Opruimen bij fout
        try {
            fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
        }
        catch { }
    }
}
async function claimTask() {
    // Pick up tasks pre-claimed by factory (status='claimed') or newly pending
    const { data: claimed } = await db
        .from('agent_tasks')
        .select('*')
        .eq('task_type', 'generate_content')
        .eq('status', 'claimed')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);
    if (claimed?.length)
        return claimed[0];
    // Fallback: pick up pending and claim atomically (optimistic lock)
    const { data: candidates } = await db
        .from('agent_tasks')
        .select('id')
        .eq('task_type', 'generate_content')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(5);
    if (!candidates?.length)
        return null;
    for (const c of candidates) {
        const { data: locked } = await db
            .from('agent_tasks')
            .update({ status: 'claimed', started_at: new Date().toISOString() })
            .eq('id', c.id)
            .eq('status', 'pending')
            .select('*')
            .single();
        if (locked)
            return locked;
    }
    return null;
}
async function poll() {
    const task = await claimTask();
    if (!task)
        return;
    await processTask(task);
}
async function main() {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('  Orlando Local AI Agent v1.0');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`Poll interval: ${POLL_INTERVAL / 1000}s`);
    log(`Output dir: ${OUTPUT_DIR}`);
    log(`AI: ${process.env.USE_LM_STUDIO !== 'false' ? 'LM Studio' : 'Ollama'}`);
    log('Wacht op taken in agent_tasks...\n');
    while (true) {
        try {
            await poll();
        }
        catch (err) {
            log('Poll fout:', err.message);
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}
main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
