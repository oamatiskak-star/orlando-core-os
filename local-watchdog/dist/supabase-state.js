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
        console.warn('[local-watchdog/supabase] no credentials — stateless mode');
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
            host_id: ev.host_id,
            service_id: ev.service_id,
            service_name: ev.service_name,
            service_type: ev.service_type,
            kind: ev.kind,
            attempt: ev.attempt ?? null,
            message: ev.message ?? null,
            logs_tail: ev.logs_tail ?? null,
            metadata: ev.metadata ?? null
        });
        if (error)
            console.error('[local-watchdog/supabase] insert event error:', error.message);
    }
    catch (err) {
        console.error('[local-watchdog/supabase] insert event throw:', err instanceof Error ? err.message : err);
    }
}
async function openIncident(input) {
    const c = getClient();
    if (!c)
        return;
    try {
        const { error } = await c.from('infra_watchdog_incidents').upsert({
            host_id: input.host_id,
            deploy_id: input.incident_key,
            service_id: input.service_id,
            service_name: input.service_name,
            service_type: input.service_type,
            failure_kind: input.failure_kind,
            failure_summary: input.failure_summary,
            logs_tail: input.logs_tail,
            attempts_made: input.attempts_made,
            proposed_actions: input.proposed_actions,
            status: 'open',
            opened_at: new Date().toISOString()
        }, { onConflict: 'host_id,deploy_id' });
        if (error)
            console.error('[local-watchdog/supabase] upsert incident error:', error.message);
    }
    catch (err) {
        console.error('[local-watchdog/supabase] upsert incident throw:', err instanceof Error ? err.message : err);
    }
}
async function resolveIncident(hostId, incidentKey) {
    const c = getClient();
    if (!c)
        return;
    try {
        await c
            .from('infra_watchdog_incidents')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('host_id', hostId)
            .eq('deploy_id', incidentKey)
            .eq('status', 'open');
    }
    catch (err) {
        console.error('[local-watchdog/supabase] resolve incident throw:', err instanceof Error ? err.message : err);
    }
}
