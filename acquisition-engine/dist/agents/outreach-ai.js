"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOutreachAI = runOutreachAI;
const supabase_1 = require("../lib/supabase");
const anthropic_1 = require("../lib/anthropic");
const logger_1 = require("../lib/logger");
// OutreachAI: genereert outreach berichten voor geplande messages in actieve sequences.
async function runOutreachAI() {
    const start = Date.now();
    const AGENT = 'OutreachAI';
    await setAgentStatus(AGENT, 'running');
    const { data: messages } = await supabase_1.supabase
        .from('acq_outreach_messages')
        .select(`
      id, step_nr, channel, subject, body, status,
      sequence_id,
      contact_id,
      acq_outreach_sequences!inner(name, seq_type, status),
      acq_crm_contacts(name, company, contact_type)
    `)
        .eq('status', 'gepland')
        .is('body', null)
        .lte('scheduled_at', new Date().toISOString())
        .limit(10);
    let processed = 0;
    for (const msg of messages ?? []) {
        try {
            const body = await generateMessage(msg);
            await supabase_1.supabase
                .from('acq_outreach_messages')
                .update({ body, subject: msg.subject ?? await generateSubject(msg) })
                .eq('id', msg.id);
            processed++;
        }
        catch (err) {
            logger_1.logger.error(`OutreachAI message ${msg.id} failed`, { err: String(err) });
        }
    }
    await setAgentStatus(AGENT, 'idle');
    logger_1.logger.info(`OutreachAI run done`, { processed, duration_ms: Date.now() - start });
    return { agent: AGENT, jobsProcessed: processed, jobsCreated: 0, duration_ms: Date.now() - start };
}
async function generateMessage(msg) {
    const sequence = msg['acq_outreach_sequences'];
    const contact = msg['acq_crm_contacts'];
    const response = await anthropic_1.anthropic.messages.create({
        model: anthropic_1.HAIKU,
        max_tokens: 400,
        system: `Je schrijft professionele Nederlandse acquisitie-berichten voor vastgoed.
Kanaal: ${msg['channel'] ?? 'email'}, Stap: ${msg['step_nr'] ?? 1}.
Schrijf een kort, direct, professioneel bericht. Geen sjabloon-placeholders. Max 150 woorden.`,
        messages: [{
                role: 'user',
                content: [
                    sequence ? `Campagne: ${sequence['name']} (${sequence['seq_type']})` : '',
                    contact ? `Contactpersoon: ${contact['name']}${contact['company'] ? ` — ${contact['company']}` : ''} (${contact['contact_type'] ?? 'contact'})` : '',
                    `Stap ${msg['step_nr'] ?? 1} van de outreach.`,
                ].filter(Boolean).join('\n'),
            }],
    });
    return response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim().slice(0, 1000);
}
async function generateSubject(msg) {
    const sequence = msg['acq_outreach_sequences'];
    return `Kennismaking${sequence ? ` — ${sequence['name']}` : ''} (stap ${msg['step_nr'] ?? 1})`;
}
async function setAgentStatus(name, status) {
    await supabase_1.supabase
        .from('acq_agent_registry')
        .update({ status, last_heartbeat: new Date().toISOString() })
        .eq('name', name);
}
//# sourceMappingURL=outreach-ai.js.map