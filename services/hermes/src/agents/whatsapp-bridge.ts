import { BaseSubagent } from './base.js';
import { supabase } from '../connectors/supabase.js';
import {
  sendInteractiveList,
  sendText,
  type InteractiveListOption,
} from '../connectors/whatsapp-cloud-api.js';

type EscalationRow = {
  id: string;
  company_slug: string;
  os_label: string;
  severity: 'critical' | 'high';
  alert_kind: string;
  resource_id: string | null;
  title: string;
  diagnosis: string;
  options: InteractiveListOption[];
  revenue_or_compliance_impact: boolean;
  status: string;
  created_at: string;
};

type RecipientRow = {
  id: string;
  phone_e164: string;
  timezone: string;
  receive_severities: string[];
  active: boolean;
};

const CLAIM_TIMEOUT_MS = 120_000; // R05 reaper: stale 'sending' > 2 min → terug naar pending
const BATCH_SIZE = 10;

/**
 * Hermes subagent #16 — WhatsApp Escalation Bridge.
 *
 * Lifecycle per escalation:
 *   pending  → sending  (claim via conditional update, R05)
 *   sending  → sent     (na succesvolle Meta send + message_id ontvangen)
 *   sending  → pending  (reaper bij stale; release bij geen recipient / fail)
 *   sent     → answered (na user reply via webhook, gematched op whatsapp_message_id)
 *   answered → actioned (na dispatch naar target subagent — volgende iteratie)
 */
export class WhatsAppBridgeAgent extends BaseSubagent {
  constructor() {
    super({
      name: 'whatsapp-bridge',
      kind: 'bridge',
      description:
        'Verstuurt kritieke escalaties naar Orlando via WhatsApp Cloud API met action-menu.',
      schedule: 'event-driven',
      maxMemoryMb: 256,
    });
  }

  async tick(): Promise<void> {
    await this.reapStaleSending();

    const db = supabase();

    const { data: candidates } = await db
      .from('escalations')
      .select('id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (!candidates || candidates.length === 0) {
      await this.healthcheck();
      return;
    }

    // Atomic claim (R05): conditional update voorkomt race tussen tick-loops
    const candidateIds = candidates.map((c) => c.id as string);
    const claimedAt = new Date().toISOString();

    const { data: claimed } = await db
      .from('escalations')
      .update({ status: 'sending', sent_at: claimedAt })
      .in('id', candidateIds)
      .eq('status', 'pending')
      .select(
        'id,company_slug,os_label,severity,alert_kind,resource_id,title,diagnosis,options,revenue_or_compliance_impact,status,created_at',
      );

    if (!claimed || claimed.length === 0) {
      await this.healthcheck();
      return;
    }

    const { data: recipients } = await db
      .from('whatsapp_recipients')
      .select('id,phone_e164,timezone,receive_severities,active')
      .eq('active', true);

    if (!recipients || recipients.length === 0) {
      await this.logEvent(
        'warn',
        'no_active_recipient',
        'Geen actieve WhatsApp recipient — claim teruggegeven, fallback nodig.',
        { claimed_count: claimed.length },
      );
      await this.releaseClaim(claimed.map((e) => e.id as string));
      await this.healthcheck();
      return;
    }

    for (const esc of claimed as EscalationRow[]) {
      await this.processEscalation(esc, recipients as RecipientRow[]);
    }

    await this.healthcheck();
  }

  override async onMessage(kind: string, payload: unknown): Promise<void> {
    if (kind !== 'whatsapp_reply') return;
    const data = payload as {
      escalation_id: string;
      user_choice: string;
      reply_from_phone: string;
    };
    await this.dispatchUserChoice(
      data.escalation_id,
      data.user_choice,
      data.reply_from_phone,
    );
  }

  private async reapStaleSending(): Promise<void> {
    const cutoff = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();
    const { data } = await supabase()
      .from('escalations')
      .update({ status: 'pending', sent_at: null })
      .eq('status', 'sending')
      .lt('sent_at', cutoff)
      .select('id');
    if (data && data.length > 0) {
      await this.logEvent('warn', 'stale_sending_reaped', undefined, {
        count: data.length,
        ids: data.map((r) => r.id),
      });
    }
  }

  private async releaseClaim(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await supabase()
      .from('escalations')
      .update({ status: 'pending', sent_at: null })
      .in('id', ids)
      .eq('status', 'sending');
  }

  private async processEscalation(
    esc: EscalationRow,
    recipients: RecipientRow[],
  ): Promise<void> {
    const eligible = recipients.filter((r) =>
      r.receive_severities.includes(esc.severity),
    );
    if (eligible.length === 0) {
      await this.releaseClaim([esc.id]);
      return;
    }

    const db = supabase();
    let anySent = false;
    let firstMessageId: string | null = null;

    for (const r of eligible) {
      const isQuiet = await this.isQuietHours(r.id);
      const overrideQuiet =
        esc.severity === 'critical' && esc.revenue_or_compliance_impact;
      if (isQuiet && !overrideQuiet) {
        this.log.info(
          { esc_id: esc.id, recipient: r.id },
          'quiet hours, skip recipient',
        );
        continue;
      }

      const result = await sendInteractiveList({
        to: r.phone_e164,
        header: `${this.severityEmoji(esc.severity)} ${esc.os_label}`,
        body: this.renderBody(esc),
        footer: `Hermes • ${new Date(esc.created_at).toLocaleString('nl-NL')}`,
        button_label: 'Kies actie',
        options: esc.options,
      });

      if (result.ok) {
        anySent = true;
        if (!firstMessageId) firstMessageId = result.messageId;
        await this.logEvent('info', 'escalation_sent', undefined, {
          escalation_id: esc.id,
          recipient: r.id,
        });
      } else {
        await this.logEvent('error', 'escalation_send_failed', result.error, {
          escalation_id: esc.id,
          recipient: r.id,
          http_status: result.status,
        });
      }
    }

    if (anySent && firstMessageId) {
      await db
        .from('escalations')
        .update({
          status: 'sent',
          whatsapp_message_id: firstMessageId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', esc.id)
        .eq('status', 'sending');
    } else {
      // Geen send gelukt of allen quiet-hours: release zodat volgende tick retried
      await this.releaseClaim([esc.id]);
    }
  }

  private async dispatchUserChoice(
    escalationId: string,
    choice: string,
    replyFromPhone: string,
  ): Promise<void> {
    const db = supabase();
    const { data: esc } = await db
      .from('escalations')
      .select('id,options,company_slug,alert_kind,resource_id,status')
      .eq('id', escalationId)
      .single();

    if (!esc) return;
    if (esc.status !== 'sent') return;

    const opt = (esc.options as InteractiveListOption[]).find(
      (o) => o.key === choice,
    );
    if (!opt) {
      await this.logEvent('warn', 'unknown_user_choice', choice, {
        escalation_id: escalationId,
        reply_from_phone: replyFromPhone,
      });
      return;
    }

    // Atomic transition sent → answered, race-veilig tegen dubbele webhook callbacks
    const { data: transitioned } = await db
      .from('escalations')
      .update({
        user_choice: choice,
        user_choice_at: new Date().toISOString(),
        reply_from_phone: replyFromPhone,
        status: 'answered',
      })
      .eq('id', escalationId)
      .eq('status', 'sent')
      .select('id');

    if (!transitioned || transitioned.length === 0) {
      // Iemand anders heeft het al verwerkt
      return;
    }

    await this.logEvent('info', 'user_choice_received', opt.label, {
      escalation_id: escalationId,
      action: opt.key,
      reply_from_phone: replyFromPhone,
    });

    // Bevestiging naar wie er heeft geantwoord (R08), niet naar willekeurige eerste recipient
    await sendText(
      replyFromPhone,
      `✓ Actie gestart: ${opt.label}\nUpdate volgt zodra klaar.`,
    );

    // TODO (volgende iteratie): dispatch naar target subagent via escalation-router.
    // Voor nu: registreer decision-audit.
    await db.from('decisions').insert({
      kind: 'user_choice',
      subject: `${esc.company_slug}/${esc.alert_kind}`,
      decision: opt.key,
      reason: opt.label,
      alternatives: esc.options,
      outcome: 'pending',
    });
  }

  private async isQuietHours(recipientId: string): Promise<boolean> {
    const { data } = await supabase().rpc('is_within_quiet_hours', {
      p_recipient_id: recipientId,
      p_at: new Date().toISOString(),
    });
    return Boolean(data);
  }

  private severityEmoji(s: 'critical' | 'high'): string {
    return s === 'critical' ? '🚨' : '🔴';
  }

  private renderBody(esc: EscalationRow): string {
    const lines = [
      `*${esc.title}*`,
      '',
      `❌ ${esc.diagnosis}`,
      '',
      'Wat wil je doen?',
      ...esc.options.map((o, i) => `${i + 1}. ${o.label}`),
    ];
    return lines.join('\n');
  }
}
