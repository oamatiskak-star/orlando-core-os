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
      description: 'Scans all incomplete items across tables for orchestration',
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
      // Get all table names from information_schema
      const { data: tables, error: tablesError } = await db
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (tablesError || !tables) {
        this.log.warn({ err: tablesError }, 'failed to fetch table list');
        return { scanned_at, incomplete_items, milestones: null };
      }

      const tableNames = (tables as any[]).map((t) => t.table_name);

      // Status columns to check
      const statusColumns = ['status', 'progress', 'state'];
      const incompleteStatuses = [
        'done',
        'completed',
        'archived',
        'cancelled',
        'finished',
        'closed',
      ];

      // Scan each table
      for (const tableName of tableNames) {
        if (tableName.startsWith('pg_') || tableName.startsWith('_')) continue;

        // Try to detect which status column exists
        for (const statusCol of statusColumns) {
          try {
            const { data, error, count } = await (db as any)
              .from(tableName)
              .select('*', { count: 'exact' })
              .not(statusCol, 'in', `(${incompleteStatuses.map((s) => `"${s}"`).join(',')})`);

            if (!error && data && (data as any[]).length > 0) {
              incomplete_items.push({
                table: tableName,
                entity: null, // Can be enhanced if entity column exists
                count: (data as any[]).length,
                items: (data as any[]).slice(0, 100), // First 100 items
              });
              break; // Found a valid status column, move to next table
            }
          } catch (e) {
            // Column doesn't exist or table doesn't exist, continue
            continue;
          }
        }
      }

      // Scan for milestones in known milestone tables
      let milestonesData = null;
      const milestoneTables = [
        'milestones',
        'goals',
        'objectives',
        'business_plan',
        'roadmap',
      ];

      for (const msTable of milestoneTables) {
        try {
          const { data, error } = await (db as any)
            .from(msTable)
            .select('*')
            .limit(1000);

          if (!error && data && (data as any[]).length > 0) {
            milestonesData = {
              table: msTable,
              items: data as any[],
            };
            break;
          }
        } catch (e) {
          continue;
        }
      }

      return {
        scanned_at,
        incomplete_items,
        milestones: milestonesData,
      };
    } catch (err) {
      this.log.error({ err }, 'scanAllIncomplete failed');
      return { scanned_at, incomplete_items, milestones: null };
    }
  }

  async onMessage(_kind: string, _payload: unknown): Promise<void> {
    // Scanner doesn't handle external messages
  }
}
