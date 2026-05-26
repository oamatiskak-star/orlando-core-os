import { SupabaseClient } from '@supabase/supabase-js';
import { AffiliateChannelSyncer } from './affiliate-channel-syncer';
import { AffiliateCountrySyncer } from './affiliate-country-syncer';

/**
 * Coordinates synchronization of all hardcoded affiliate strategies to the database
 * Manages both channel and country mapping syncs with proper error handling
 */
export class AffiliateIntelligenceSync {
  private channelSyncer: AffiliateChannelSyncer;
  private countrySyncer: AffiliateCountrySyncer;

  constructor(private supabase: SupabaseClient) {
    this.channelSyncer = new AffiliateChannelSyncer(supabase);
    this.countrySyncer = new AffiliateCountrySyncer(supabase);
  }

  /**
   * Main synchronization method - syncs all affiliate intelligence data to database
   * Call this during app initialization to populate affiliate strategies
   * Safe to call multiple times - uses upsert operations
   */
  async synchronizeAll(): Promise<{
    success: boolean;
    channelMappings: { synced: number; skipped: number };
    countryMappings: { synced: number; skipped: number };
    totalSynced: number;
    totalSkipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let totalSynced = 0;
    let totalSkipped = 0;

    console.log('[AffiliateIntelligenceSync] Starting synchronization...');

    // 1. Sync channel mappings (must be first since other operations depend on them)
    console.log('[AffiliateIntelligenceSync] Syncing channel mappings...');
    let channelResults = { synced: 0, skipped: 0 };
    try {
      channelResults = await this.channelSyncer.syncChannelMappings();
      console.log(
        `[AffiliateIntelligenceSync] Channel mappings: ${channelResults.synced} synced, ${channelResults.skipped} skipped`
      );
      totalSynced += channelResults.synced;
      totalSkipped += channelResults.skipped;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AffiliateIntelligenceSync] Channel mapping sync failed:', errorMessage);
      errors.push(`Channel sync failed: ${errorMessage}`);
    }

    // 2. Sync country mappings
    console.log('[AffiliateIntelligenceSync] Syncing country mappings...');
    let countryResults = { synced: 0, skipped: 0 };
    try {
      countryResults = await this.countrySyncer.syncCountryMappings();
      console.log(
        `[AffiliateIntelligenceSync] Country mappings: ${countryResults.synced} synced, ${countryResults.skipped} skipped`
      );
      totalSynced += countryResults.synced;
      totalSkipped += countryResults.skipped;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AffiliateIntelligenceSync] Country mapping sync failed:', errorMessage);
      errors.push(`Country sync failed: ${errorMessage}`);
    }

    // 3. Update affiliate_programs with aggregated intelligence data
    console.log('[AffiliateIntelligenceSync] Updating affiliate program intelligence fields...');
    try {
      await this.updateAffiliateIntelligence();
      console.log('[AffiliateIntelligenceSync] Affiliate intelligence updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[AffiliateIntelligenceSync] Affiliate intelligence update failed:', errorMessage);
      errors.push(`Intelligence update failed: ${errorMessage}`);
    }

    const success = errors.length === 0;
    console.log(
      `[AffiliateIntelligenceSync] Synchronization ${success ? 'completed successfully' : 'completed with errors'}`
    );
    console.log(
      `[AffiliateIntelligenceSync] Total: ${totalSynced} synced, ${totalSkipped} skipped`
    );

    return {
      success,
      channelMappings: channelResults,
      countryMappings: countryResults,
      totalSynced,
      totalSkipped,
      errors,
    };
  }

  /**
   * Update affiliate_programs table with aggregated intelligence data
   * Calculates optimal channels, countries, and performance metrics per affiliate
   */
  private async updateAffiliateIntelligence(): Promise<void> {
    // Get all affiliate programs
    const { data: programs, error: programsError } = await this.supabase
      .from('affiliate_programs')
      .select('id, name');

    if (programsError || !programs) {
      throw new Error(`Failed to fetch affiliate programs: ${programsError?.message}`);
    }

    for (const program of programs) {
      try {
        // Get optimal channels for this affiliate (those with highest priority)
        const { data: channelMappings } = await this.supabase
          .from('affiliate_channel_mappings')
          .select('channel_id')
          .eq('affiliate_program_id', program.id)
          .eq('is_active', true)
          .order('priority', { ascending: true })
          .limit(5); // Top 5 optimal channels

        const optimalChannels = channelMappings?.map((m: any) => m.channel_id) || [];

        // Get optimal countries for this affiliate
        const { data: countryMappings } = await this.supabase
          .from('affiliate_country_mappings')
          .select('country_code')
          .eq('affiliate_program_id', program.id)
          .eq('is_available', true)
          .eq('is_recommended', true);

        const optimalCountries = countryMappings?.map((m: any) => m.country_code) || [];

        // Calculate average performance metrics across all channels/countries
        const { data: allMappings } = await this.supabase
          .from('affiliate_channel_mappings')
          .select('est_conversion_rate, est_epc')
          .eq('affiliate_program_id', program.id)
          .eq('is_active', true);

        let avgConversionRate = 0;
        let avgEpc = 0;

        if (allMappings && allMappings.length > 0) {
          const validMappings = allMappings.filter((m: any) => m.est_conversion_rate && m.est_epc);
          if (validMappings.length > 0) {
            avgConversionRate =
              validMappings.reduce((sum: number, m: any) => sum + m.est_conversion_rate, 0) /
              validMappings.length;
            avgEpc =
              validMappings.reduce((sum: number, m: any) => sum + m.est_epc, 0) / validMappings.length;
          }
        }

        // Calculate audience fit score (0-100) based on country availability
        const audienceFitScore = Math.min(
          100,
          Math.max(0, optimalCountries.length * 10 + (optimalChannels.length * 5))
        );

        // Update affiliate program with calculated intelligence fields
        const { error: updateError } = await this.supabase
          .from('affiliate_programs')
          .update({
            optimal_channels: optimalChannels,
            optimal_countries: optimalCountries,
            avg_conversion_rate: avgConversionRate > 0 ? avgConversionRate : null,
            avg_epc: avgEpc > 0 ? avgEpc : null,
            audience_fit_score: audienceFitScore,
            last_performance_update: new Date().toISOString(),
          })
          .eq('id', program.id);

        if (updateError) {
          console.error(
            `Failed to update intelligence for ${program.name}:`,
            updateError.message
          );
        }
      } catch (error) {
        console.error(
          `Error updating intelligence for ${program.name}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Sync only channel mappings (useful for targeted updates)
   */
  async syncChannelMappingsOnly(): Promise<{ synced: number; skipped: number }> {
    return this.channelSyncer.syncChannelMappings();
  }

  /**
   * Sync only country mappings (useful for targeted updates)
   */
  async syncCountryMappingsOnly(): Promise<{ synced: number; skipped: number }> {
    return this.countrySyncer.syncCountryMappings();
  }
}

/**
 * Factory function to create and initialize sync instance
 */
export function createAffiliateIntelligenceSync(
  supabase: SupabaseClient
): AffiliateIntelligenceSync {
  return new AffiliateIntelligenceSync(supabase);
}
