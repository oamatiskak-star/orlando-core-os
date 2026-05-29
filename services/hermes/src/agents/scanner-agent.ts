import { BaseSubagent } from './base.js';
import { supabase } from '../connectors/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ScanResult {
  scanned_at: string;
  incomplete_items: {
    table: string;
    entity: string | null;
    count: number;
    items: Record<string, any>[];
  }[];
  milestones: {
    table: string;
    items: Record<string, any>[];
  } | null;
}

export class ScannerAgent extends BaseSubagent {
  constructor() {
    super({
      name: 'Hermes Scanner',
      kind: 'monitor',
      description: 'Bewaakt hermes.dispatch_queue: niet-afgeronde + geblokkeerde/gefaalde taken voor orchestration',
      schedule: '0 * * * *', // hourly
      maxMemoryMb: 512,
      config: {},
    });
  }

  async tick(): Promise<void> {
    try {
      const result = await this.scanAllIncomplete();
      this.log.info(
        { incomplete_count: result.incomplete_items.length, scanned_at: result.scanned_at },
        'scan complete',
      );
    } catch (err) {
      this.log.error({ err }, 'scan failed');
    }
  }

  async scanAllIncomplete(): Promise<ScanResult> {
    const db = supabase();
    const scanned_at = new Date().toISOString();
    const incomplete_items: ScanResult['incomplete_items'] = [];

    try {
      // Hermes orchestration-queue. De supabase()-client is hermes-scoped, dus
      // 'dispatch_queue' = hermes.dispatch_queue. Surface elke niet-terminale taak;
      // geen information_schema-introspectie meer (gaf PGRST205).
      const terminal = ['done', 'cancelled'];
      const { data, error } = await db
        .from('dispatch_queue')
        .select(
          'id,title,workstream,repo,target_host,status,priority,claimed_by,depends_on,created_at,updated_at',
        )
        .not('status', 'in', `(${terminal.map((s) => `"${s}"`).join(',')})`)
        .order('priority', { ascending: true })
        .limit(500);

      if (error) {
        this.log.warn({ err: error }, 'dispatch_queue scan failed');
        return { scanned_at, incomplete_items, milestones: null };
      }

      const items = (data as Record<string, any>[]) ?? [];
      if (items.length > 0) {
        incomplete_items.push({
          table: 'hermes.dispatch_queue',
          entity: null,
          count: items.length,
          items: items.slice(0, 200),
        });
      }

      // Aandacht-subset: geblokkeerde/gefaalde taken vragen om orchestration.
      const attention = items.filter(
        (i) => i.status === 'blocked' || i.status === 'failed',
      );
      if (attention.length > 0) {
        incomplete_items.push({
          table: 'hermes.dispatch_queue:attention',
          entity: 'blocked_or_failed',
          count: attention.length,
          items: attention.slice(0, 100),
        });
      }

      return { scanned_at, incomplete_items, milestones: null };
    } catch (err) {
      this.log.error({ err }, 'scanAllIncomplete failed');
      return { scanned_at, incomplete_items, milestones: null };
    }
  }

  override async onMessage(_kind: string, _payload: unknown): Promise<void> {
    // Scanner doesn't handle external messages
  }
}
