import { hermesDb } from './shared.js'

/**
 * Incident keyword patterns. Kept identical in wording to the frontend
 * command-router INCIDENT_PATTERNS (cannot import frontend TS from here).
 */
export const INCIDENT_PATTERNS: RegExp[] = [
  // betalingen
  /betaling(en)?.*(werkt? niet|werken niet|mislukt|mislukken|kan niet|faalt|falen)/i,
  /(kan|kunnen).*niet.*betal/i,
  // login
  /login.*(werkt niet|mislukt|kan niet)/i,
  /(kan|kunnen).*niet.*inlogg/i,
  // checkout
  /checkout.*(werkt niet|mislukt|hangt|kan niet)/i,
  // website / pagina laadt of werkt niet
  /(website|site|pagina|homepage).*(offline|plat|down|onbereikbaar|laadt? niet|laden niet|werkt niet|werken niet)/i,
  // deployment
  /deployment.*(fout|mislukt|faalt|gefaald)/i,
  /deploy.*(mislukt|faalt|gefaald)/i,
  // data
  /data.*(kwijt|weg|verloren|gewist)/i,
  // pdf
  /pdf.*(fout|mislukt|niet gegenereerd|kapot|werkt niet|lukt niet)/i,
  // generieke storingsfrasen
  /\b(laadt|laden|werkt|werken|reageert)\s+niet\b/i,
]

export function detectIncident(message: string): boolean {
  return INCIDENT_PATTERNS.some(re => re.test(message))
}

/**
 * On P1 incidents, surface a proactive alert (reuses hermes.proactive_alerts,
 * mig 121). company_id must be a real public.companies id (FK). Best-effort.
 */
export async function raiseIncidentAlert(opts: {
  companyId: string
  message: string
  activeProject: string
}): Promise<void> {
  try {
    await hermesDb()
      .from('proactive_alerts')
      .insert({
        company_id: opts.companyId,
        alert_type: 'incident',
        severity: 'critical',
        description: `P1 incident (${opts.activeProject}): ${opts.message.slice(0, 280)}`,
        affected_entity: opts.activeProject,
        metadata: { source: 'hermes-orchestrator', raw: opts.message },
      })
  } catch {
    /* alert is best-effort; pipeline continues regardless */
  }
}
