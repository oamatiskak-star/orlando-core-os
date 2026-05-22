"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordEvent = recordEvent;
exports.openIncident = openIncident;
exports.resolveIncident = resolveIncident;
const supabase_js_1 = require("@supabase/supabase-js");
let client = null;
function getClient() {
    if (client)
        return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.warn('[watchdog/supabase] no credentials — running in stateless mode');
        return null;
    }
    client = (0, supabase_js_1.createClient)(url, key, { auth: { persistSession: false } });
    return client;
}
async function recordEvent(ev) {
    const c = getClient();
    if (!c)
        return;
    try {
        const { error } = await c.from('infra_watchdog_events').insert({
            service_id: ev.service_id,
            service_name: ev.service_name,
            service_type: ev.service_type,
            kind: ev.kind,
            deploy_id: ev.deploy_id ?? null,
            deploy_status: ev.deploy_status ?? null,
            attempt: ev.attempt ?? null,
            message: ev.message ?? null,
            logs_tail: ev.logs_tail ?? null,
            metadata: ev.metadata ?? null
        });
        if (error)
            console.error('[watchdog/supabase] insert event error:', error.message);
    }
    catch (err) {
        console.error('[watchdog/supabase] insert event throw:', err instanceof Error ? err.message : err);
    }
}
async function openIncident(input) {
    const c = getClient();
    if (!c)
        return;
    try {
        const { error } = await c.from('infra_watchdog_incidents').upsert({
            service_id: input.service_id,
            deploy_id: input.deploy_id,
            service_name: input.service_name,
            service_type: input.service_type,
            failure_kind: input.failure_kind,
            failure_summary: input.failure_summary,
            logs_tail: input.logs_tail,
            commit_sha: input.commit_sha ?? null,
            commit_message: input.commit_message ?? null,
            attempts_made: input.attempts_made,
            proposed_actions: input.proposed_actions,
            status: 'open',
            opened_at: new Date().toISOString()
        }, { onConflict: 'deploy_id' });
        if (error)
            console.error('[watchdog/supabase] upsert incident error:', error.message);
    }
    catch (err) {
        console.error('[watchdog/supabase] upsert incident throw:', err instanceof Error ? err.message : err);
    }
}
async function resolveIncident(deployId) {
    const c = getClient();
    if (!c)
        return;
    try {
        await c
            .from('infra_watchdog_incidents')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('deploy_id', deployId)
            .eq('status', 'open');
    }
    catch (err) {
        console.error('[watchdog/supabase] resolve incident throw:', err instanceof Error ? err.message : err);
    }
}
