"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const db = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const INTERVAL_MS = 10_000;
// ── AI engine pings ───────────────────────────────────────────────────────────
async function pingLMStudio() {
    const t0 = Date.now();
    try {
        const res = await axios_1.default.get(`${LM_STUDIO_URL}/v1/models`, { timeout: 3_000 });
        const models = (res.data?.data ?? []);
        return {
            online: true,
            loaded_model: models[0]?.id ?? null,
            available_models: models.map(m => ({ name: m.id, family: m.owned_by ?? 'unknown' })),
            response_ms: Date.now() - t0,
            last_error: null,
        };
    }
    catch (err) {
        return { online: false, loaded_model: null, available_models: [], response_ms: null, last_error: err.code === 'ECONNREFUSED' ? 'Offline' : err.message };
    }
}
async function pingOllama() {
    const t0 = Date.now();
    try {
        const [tagsRes, psRes] = await Promise.all([
            axios_1.default.get(`${OLLAMA_URL}/api/tags`, { timeout: 3_000 }),
            axios_1.default.get(`${OLLAMA_URL}/api/ps`, { timeout: 3_000 }),
        ]);
        const tags = (tagsRes.data?.models ?? []);
        const running = (psRes.data?.models ?? []);
        return {
            online: true,
            loaded_model: running[0]?.name ?? tags[0]?.name ?? null,
            available_models: tags.map(m => ({ name: m.name, size_gb: (m.size / 1e9).toFixed(1), family: m.details?.family ?? 'unknown', quant: m.details?.quantization_level ?? '' })),
            running_models: running.map(m => ({ name: m.name, size_gb: (m.size / 1e9).toFixed(1) })),
            response_ms: Date.now() - t0,
            last_error: null,
        };
    }
    catch (err) {
        return { online: false, loaded_model: null, available_models: [], running_models: [], response_ms: null, last_error: err.code === 'ECONNREFUSED' ? 'Offline' : err.message };
    }
}
// ── Task stats ────────────────────────────────────────────────────────────────
async function getTodayStats() {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { data } = await db
        .from('agent_tasks')
        .select('started_at, completed_at')
        .eq('task_type', 'generate_content')
        .eq('status', 'completed')
        .gte('completed_at', todayStart.toISOString());
    if (!data?.length)
        return { requests_today: 0, avg_duration_s: null, tasks_total: 0 };
    const durations = data
        .filter(r => r.started_at && r.completed_at)
        .map(r => (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000);
    const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const { count: total } = await db
        .from('agent_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('task_type', 'generate_content')
        .eq('status', 'completed');
    return {
        requests_today: data.length,
        avg_duration_s: avg ? Math.round(avg) : null,
        tasks_total: total ?? 0,
    };
}
function getPM2Status() {
    try {
        const raw = (0, child_process_1.execSync)('pm2 jlist 2>/dev/null', { timeout: 5_000 }).toString();
        const procs = JSON.parse(raw);
        return procs.map(p => ({
            id: p.name,
            name: p.name,
            status: p.pm2_env?.status ?? 'unknown',
            cpu: p.monit?.cpu ?? 0,
            memory: Math.round((p.monit?.memory ?? 0) / 1024 / 1024),
            uptime: p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000) : 0,
        }));
    }
    catch {
        return [];
    }
}
// ── Worker registry map (PM2 name → registry id) ──────────────────────────────
const PM2_TO_REGISTRY = {
    'content-factory': 'content-factory',
    'video-worker-1': 'W1',
    'video-worker-2': 'W2',
    'seo-optimizer': 'seo-optimizer',
    'status-reporter': 'status-reporter',
};
function pm2StatusToWorkerStatus(pm2) {
    switch (pm2) {
        case 'online': return 'online';
        case 'stopped': return 'offline';
        case 'errored': return 'error';
        case 'stopping': return 'offline';
        default: return 'offline';
    }
}
// ── Active task check ─────────────────────────────────────────────────────────
async function getActiveTasksPerWorker() {
    const { data } = await db
        .from('agent_tasks')
        .select('id, status, payload')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(10);
    const map = {};
    for (const t of (data ?? [])) {
        const workerId = t.payload?.worker_id ?? 'W1';
        map[workerId] = {
            id: t.id,
            description: `${t.payload?.channel_name ?? ''} — ${t.payload?.topic?.slice(0, 60) ?? ''}`,
        };
    }
    return map;
}
async function getQueueDepth() {
    const { count } = await db
        .from('agent_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('task_type', 'generate_content')
        .eq('status', 'claimed');
    return count ?? 0;
}
// ── Main report ───────────────────────────────────────────────────────────────
async function report() {
    const [lm, ol, stats, pm2Procs, activeTasks, queueDepth] = await Promise.all([
        pingLMStudio(),
        pingOllama(),
        getTodayStats(),
        Promise.resolve(getPM2Status()),
        getActiveTasksPerWorker(),
        getQueueDepth(),
    ]);
    const now = new Date().toISOString();
    // ── ai_worker_status (legacy table — keep compatible) ────────────────
    await Promise.all([
        db.from('ai_worker_status').upsert({
            engine: 'lmstudio', online: lm.online, loaded_model: lm.loaded_model,
            available_models: lm.available_models, running_models: [],
            response_ms: lm.response_ms, requests_today: stats.requests_today,
            avg_duration_s: stats.avg_duration_s, last_error: lm.last_error, updated_at: now,
        }, { onConflict: 'engine' }),
        db.from('ai_worker_status').upsert({
            engine: 'ollama', online: ol.online, loaded_model: ol.loaded_model,
            available_models: ol.available_models, running_models: ol.running_models,
            response_ms: ol.response_ms, requests_today: stats.requests_today,
            avg_duration_s: stats.avg_duration_s, last_error: ol.last_error, updated_at: now,
        }, { onConflict: 'engine' }),
    ]);
    // ── worker_registry (new Mission Control table) ────────────────────────
    const upserts = [];
    const aiOnline = lm.online || ol.online;
    // Status reporter self-heartbeat
    upserts.push({
        id: 'status-reporter',
        worker_type: 'status-reporter',
        display_name: 'Status Reporter',
        host: 'mac-mini-1',
        status: 'online',
        tasks_today: 0,
        tasks_total: 0,
        uptime_seconds: Math.round(process.uptime()),
        last_heartbeat: now,
        updated_at: now,
        metadata: {
            lm_studio: { online: lm.online, model: lm.loaded_model, ping_ms: lm.response_ms },
            ollama: { online: ol.online, model: ol.loaded_model, ping_ms: ol.response_ms },
        },
    });
    // PM2-based local workers
    for (const proc of pm2Procs) {
        const registryId = PM2_TO_REGISTRY[proc.name];
        if (!registryId || registryId === 'status-reporter')
            continue;
        const active = activeTasks[registryId];
        const isContent = registryId === 'W1' || registryId === 'W2';
        upserts.push({
            id: registryId,
            status: pm2StatusToWorkerStatus(proc.status),
            cpu_percent: proc.cpu,
            ram_mb: proc.memory,
            uptime_seconds: proc.uptime,
            current_task_id: active?.id ?? null,
            current_task_description: active?.description ?? null,
            queue_depth: isContent ? queueDepth : 0,
            tasks_today: isContent ? stats.requests_today : 0,
            tasks_total: isContent ? stats.tasks_total : 0,
            avg_task_duration_s: stats.avg_duration_s,
            last_heartbeat: now,
            updated_at: now,
        });
    }
    if (upserts.length > 0) {
        await db.from('worker_registry').upsert(upserts, { onConflict: 'id' });
    }
}
async function main() {
    console.log('[status-reporter] Start — poll elke 10s naar Supabase (ai_worker_status + worker_registry)');
    while (true) {
        try {
            await report();
        }
        catch (err) {
            console.error('[status-reporter] Fout:', err.message);
        }
        await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
}
main();
