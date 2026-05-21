"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBuildOppsScanner = runBuildOppsScanner;
const supabase_1 = require("../lib/supabase");
const anthropic_1 = require("../lib/anthropic");
const logger_1 = require("../lib/logger");
// BuildOppsScanner: verrijkt nieuwe acq_build_opps met AI-analyse.
// Scored relevantie voor STRKBEHEER/STRKBOUW op basis van:
// - Grootte (estimated_value)
// - Type werk (nieuwbouw/renovatie/transformatie)
// - Deadline haalbaarheid
// - Geografische dekking
// Voegt ook short notes toe voor tender-strategie.
async function runBuildOppsScanner() {
    const start = Date.now();
    const AGENT = 'BuildOppsScanner';
    await setAgentStatus(AGENT, 'running');
    // Verwerk nieuwe opps zonder notes/strategie
    const { data: opps } = await supabase_1.supabase
        .from('acq_build_opps')
        .select('id, title, opp_type, client, estimated_value, deadline, source, municipality, province, notes')
        .eq('pipeline_stage', 'signalering')
        .is('notes', null)
        .limit(10);
    let processed = 0;
    let promoted = 0;
    for (const opp of opps ?? []) {
        try {
            const analysis = await analyzeOpp(opp);
            const newStage = analysis.relevance_score >= 70 ? 'analyse' :
                analysis.relevance_score >= 40 ? 'signalering' : 'verloren';
            await supabase_1.supabase
                .from('acq_build_opps')
                .update({
                notes: analysis.strategy,
                pipeline_stage: newStage,
                updated_at: new Date().toISOString(),
            })
                .eq('id', opp.id);
            if (newStage === 'analyse')
                promoted++;
            processed++;
        }
        catch (err) {
            logger_1.logger.error(`BuildOppsScanner opp ${opp.id} failed`, { err: String(err) });
        }
    }
    await setAgentStatus(AGENT, 'idle');
    logger_1.logger.info(`BuildOppsScanner done`, { processed, promoted, duration_ms: Date.now() - start });
    return { agent: AGENT, jobsProcessed: processed, jobsCreated: promoted, duration_ms: Date.now() - start };
}
async function analyzeOpp(opp) {
    // Snelle rule-based score eerst
    let score = 30;
    if (opp.estimated_value) {
        if (opp.estimated_value > 5000000)
            score += 30;
        else if (opp.estimated_value > 1000000)
            score += 20;
        else if (opp.estimated_value > 250000)
            score += 10;
    }
    const goodTypes = ['renovatie', 'nieuwbouw', 'transformatie', 'uitbouw'];
    if (opp.opp_type && goodTypes.includes(opp.opp_type))
        score += 15;
    if (opp.deadline) {
        const daysLeft = (new Date(opp.deadline).getTime() - Date.now()) / 86400000;
        if (daysLeft > 14 && daysLeft < 90)
            score += 10;
    }
    const goodProvinces = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Noord-Brabant', 'Gelderland'];
    if (opp.province && goodProvinces.includes(opp.province))
        score += 10;
    score = Math.min(100, score);
    // Alleen LLM voor kansrijke opps (score > 40) — kostenbesparing
    if (score < 40) {
        return { relevance_score: score, strategy: 'Lage relevantie — niet verder vervolgen.' };
    }
    const msg = await anthropic_1.anthropic.messages.create({
        model: anthropic_1.HAIKU,
        max_tokens: 250,
        system: `Je bent tender-strateeg voor een Nederlandse bouwonderneming (STRKBOUW).
Analyseer de aanbesteding en geef in 2-3 zinnen: (1) of dit kansrijk is, (2) concrete volgende stap.
Wees direct en zakelijk.`,
        messages: [{
                role: 'user',
                content: [
                    `Titel: ${opp.title}`,
                    `Type: ${opp.opp_type ?? 'n/a'}`,
                    opp.client ? `Opdrachtgever: ${opp.client}` : '',
                    opp.estimated_value ? `Waarde: €${opp.estimated_value.toLocaleString('nl-NL')}` : '',
                    opp.deadline ? `Deadline: ${opp.deadline}` : '',
                    opp.province ? `Provincie: ${opp.province}` : '',
                ].filter(Boolean).join('\n'),
            }],
    });
    const strategy = msg.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()
        .slice(0, 400);
    return { relevance_score: score, strategy };
}
async function setAgentStatus(name, status) {
    try {
        await supabase_1.supabase
            .from('acq_agent_registry')
            .update({ status, last_heartbeat: new Date().toISOString() })
            .eq('name', name);
    }
    catch (err) {
        // Ignore errors updating status
    }
}
//# sourceMappingURL=build-opps-scanner.js.map