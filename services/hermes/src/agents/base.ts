import { supabase } from '../connectors/supabase.js';
import { childLogger } from '../core/logger.js';

export type SubagentKind =
  | 'scheduler'
  | 'monitor'
  | 'bridge'
  | 'supervisor'
  | 'ops';

export interface SubagentDef {
  name: string;
  kind: SubagentKind;
  description: string;
  schedule: string;
  maxMemoryMb?: number;
  config?: Record<string, unknown>;
}

export interface Subagent {
  def: SubagentDef;
  /** Eénmalige registratie bij boot. Geeft DB-id terug. */
  register(): Promise<string>;
  /** Eén tick. Lege impl betekent event-driven of polling extern. */
  tick(): Promise<void>;
  /** Verwerkt inkomend signaal (bv. WhatsApp webhook). */
  onMessage(kind: string, payload: unknown): Promise<void>;
  /** Healthcheck; schrijft heartbeat naar hermes.agent_state. */
  healthcheck(): Promise<{ ok: boolean; notes?: string }>;
}

export abstract class BaseSubagent implements Subagent {
  protected log;
  protected id: string | null = null;

  constructor(public readonly def: SubagentDef) {
    this.log = childLogger({ subagent: def.name });
  }

  async register(): Promise<string> {
    const db = supabase();
    const { data, error } = await db
      .from('subagents')
      .upsert(
        {
          name: this.def.name,
          kind: this.def.kind,
          description: this.def.description,
          schedule: this.def.schedule,
          max_memory_mb: this.def.maxMemoryMb ?? 512,
          config: this.def.config ?? {},
        },
        { onConflict: 'name' },
      )
      .select('id')
      .single();

    if (error || !data) {
      this.log.error({ err: error }, 'subagent register failed');
      throw new Error(`subagent register failed: ${error?.message ?? 'no data'}`);
    }
    this.id = data.id as string;

    await db
      .from('agent_state')
      .upsert(
        { subagent_id: this.id, status: 'starting', last_heartbeat_at: new Date().toISOString() },
        { onConflict: 'subagent_id' },
      );

    this.log.info({ id: this.id }, 'subagent registered');
    return this.id;
  }

  abstract tick(): Promise<void>;

  async onMessage(_kind: string, _payload: unknown): Promise<void> {
    // default: no-op. Subclasses override.
  }

  async healthcheck(): Promise<{ ok: boolean; notes?: string }> {
    if (!this.id) return { ok: false, notes: 'not registered' };
    await supabase()
      .from('agent_state')
      .update({
        status: 'running',
        last_heartbeat_at: new Date().toISOString(),
        last_tick_at: new Date().toISOString(),
      })
      .eq('subagent_id', this.id);
    return { ok: true };
  }

  protected async logEvent(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    event: string,
    message?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await supabase().from('logs').insert({
      subagent_id: this.id,
      level,
      event,
      message: message ?? null,
      context: context ?? {},
    });
  }
}
