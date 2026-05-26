import { SupabaseClient } from '@supabase/supabase-js';
import { CHANNEL_STRATEGIES, AFFILIATE_CHANNEL_MAPPINGS } from './channel-profile-matcher';

/**
 * Syncs hardcoded channel-affiliate mappings to database
 * Converts AFFILIATE_CHANNEL_MAPPINGS into affiliate_channel_mappings table rows
 */
export class AffiliateChannelSyncer {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Sync all channel-affiliate mappings from memory to database
   * Called during initialization or when strategies change
   */
  async syncChannelMappings(): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    for (const [channelId, mappings] of Object.entries(AFFILIATE_CHANNEL_MAPPINGS)) {
      for (const mapping of mappings) {
        const { data: affiliateProgram } = await this.supabase
          .from('affiliate_programs')
          .select('id')
          .eq('name', mapping.affiliate_id)
          .single();

        if (!affiliateProgram) {
          skipped++;
          continue;
        }

        const { data: channel } = await this.supabase
          .from('media_holding_channels')
          .select('id')
          .eq('name', channelId)
          .single();

        if (!channel) {
          skipped++;
          continue;
        }

        const { error } = await this.supabase
          .from('affiliate_channel_mappings')
          .upsert(
            {
              affiliate_program_id: affiliateProgram.id,
              channel_id: channel.id,
              priority: mapping.priority,
              reason: `${mapping.affiliate_id} for ${channelId}`,
              est_conversion_rate: 0.05, // Default estimate
              est_epc: 15.0, // Default estimate
              is_active: true,
              metadata: {
                strategy_source: 'channel-profile-matcher',
                synced_at: new Date().toISOString(),
              },
            },
            { onConflict: 'affiliate_program_id,channel_id' }
          );

        if (error) {
          console.error(`Failed to sync mapping: ${error.message}`);
          skipped++;
        } else {
          synced++;
        }
      }
    }

    return { synced, skipped };
  }

  /**
   * Update channel mappings with performance data
   * Called after performance data is collected
   */
  async updateChannelPerformance(
    affiliateId: string,
    channelId: string,
    conversionRate: number,
    epc: number
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('affiliate_channel_mappings')
      .update({
        est_conversion_rate: conversionRate,
        est_epc: epc,
        last_performance_sync: new Date().toISOString(),
      })
      .match({
        affiliate_program_id: affiliateId,
        channel_id: channelId,
      });

    return !error;
  }

  /**
   * Get active affiliate-channel mappings for a channel
   * Ordered by priority
   */
  async getChannelMappings(
    channelId: string
  ): Promise<
    Array<{
      affiliate_id: string;
      priority: number;
      est_conversion_rate: number;
      est_epc: number;
    }>
  > {
    const { data, error } = await this.supabase
      .from('affiliate_channel_mappings')
      .select(
        `
        affiliate_program_id,
        priority,
        est_conversion_rate,
        est_epc,
        affiliate_programs(name)
      `
      )
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error || !data) {
      console.error(`Failed to fetch channel mappings: ${error?.message}`);
      return [];
    }

    return data.map((row: any) => ({
      affiliate_id: row.affiliate_programs?.name || '',
      priority: row.priority,
      est_conversion_rate: row.est_conversion_rate || 0,
      est_epc: row.est_epc || 0,
    }));
  }

  /**
   * Deactivate an affiliate-channel mapping
   */
  async deactivateMapping(affiliateId: string, channelId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('affiliate_channel_mappings')
      .update({ is_active: false })
      .match({
        affiliate_program_id: affiliateId,
        channel_id: channelId,
      });

    return !error;
  }
}
