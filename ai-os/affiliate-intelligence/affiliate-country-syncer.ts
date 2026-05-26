import { SupabaseClient } from '@supabase/supabase-js';
import { COUNTRY_AFFILIATE_AVAILABILITY } from './audience-matcher';
import { PerformanceScorer } from './performance-scorer';

/**
 * Syncs hardcoded country-affiliate availability mappings to database
 * Converts COUNTRY_AFFILIATE_AVAILABILITY into affiliate_country_mappings table rows
 */
export class AffiliateCountrySyncer {
  private performanceScorer: PerformanceScorer;

  constructor(private supabase: SupabaseClient) {
    this.performanceScorer = new PerformanceScorer();
  }

  /**
   * Sync all country-affiliate availability mappings from memory to database
   * Called during initialization or when strategies change
   */
  async syncCountryMappings(): Promise<{ synced: number; skipped: number }> {
    let synced = 0;
    let skipped = 0;

    for (const [countryCode, affiliateIds] of Object.entries(COUNTRY_AFFILIATE_AVAILABILITY)) {
      for (const affiliateId of affiliateIds) {
        const { data: affiliateProgram } = await this.supabase
          .from('affiliate_programs')
          .select('id')
          .eq('name', affiliateId)
          .single();

        if (!affiliateProgram) {
          skipped++;
          continue;
        }

        // Get performance metrics for this affiliate in this country (if available)
        const metrics = this.performanceScorer.getPerformanceMetrics(affiliateId);
        const avgConversionRate = this.performanceScorer.getAverageConversionRate(affiliateId);
        const avgEpc = this.performanceScorer.getAverageEpc(affiliateId);

        // Determine if recommended based on performance
        const isRecommended = avgConversionRate > 0.1; // Recommend if conversion rate > 10%

        const { error } = await this.supabase
          .from('affiliate_country_mappings')
          .upsert(
            {
              affiliate_program_id: affiliateProgram.id,
              country_code: countryCode,
              is_available: true,
              is_recommended: isRecommended,
              avg_conversion_rate: avgConversionRate > 0 ? avgConversionRate : null,
              avg_epc: avgEpc > 0 ? avgEpc : null,
              compliance_notes: this.getComplianceNotes(countryCode),
              payout_currency: this.getPayoutCurrency(countryCode),
              payout_threshold: this.getPayoutThreshold(countryCode),
              tax_id_required: this.requiresTaxId(countryCode),
              last_sync: new Date().toISOString(),
              metadata: {
                strategy_source: 'audience-matcher',
                synced_at: new Date().toISOString(),
              },
            },
            { onConflict: 'affiliate_program_id,country_code' }
          );

        if (error) {
          console.error(`Failed to sync country mapping: ${error.message}`);
          skipped++;
        } else {
          synced++;
        }
      }
    }

    return { synced, skipped };
  }

  /**
   * Get compliance notes for a country
   */
  private getComplianceNotes(countryCode: string): string | null {
    const notes: Record<string, string> = {
      DE: 'German tax ID may be required for certain product categories',
      US: 'Standard US tax compliance. Some products require state-specific handling',
      UK: 'UK tax compliance applies. Post-Brexit VAT regulations',
      UAE: 'UAE tax ID required. No VAT on most digital products',
      FR: 'French affiliate tax regulations apply',
      ES: 'Spanish affiliate regulations apply',
      BE: 'Belgian tax compliance applies',
    };
    return notes[countryCode] || null;
  }

  /**
   * Get payout currency for a country
   */
  private getPayoutCurrency(countryCode: string): string {
    const currencies: Record<string, string> = {
      US: 'USD',
      UK: 'GBP',
      UAE: 'AED',
      DE: 'EUR',
      FR: 'EUR',
      ES: 'EUR',
      BE: 'EUR',
      NL: 'EUR',
    };
    return currencies[countryCode] || 'USD';
  }

  /**
   * Get minimum payout threshold for a country
   */
  private getPayoutThreshold(countryCode: string): number {
    const thresholds: Record<string, number> = {
      US: 100.0,
      UK: 100.0,
      UAE: 150.0, // Higher threshold due to currency conversion costs
      DE: 100.0,
      FR: 100.0,
      ES: 100.0,
      BE: 100.0,
      NL: 100.0,
    };
    return thresholds[countryCode] || 100.0;
  }

  /**
   * Check if country requires tax ID
   */
  private requiresTaxId(countryCode: string): boolean {
    const requiresTax: Record<string, boolean> = {
      US: true,
      UK: true,
      UAE: true,
      DE: true,
      FR: true,
      ES: true,
      BE: false,
      NL: false,
    };
    return requiresTax[countryCode] || false;
  }

  /**
   * Update country mapping availability status
   */
  async updateCountryAvailability(
    affiliateId: string,
    countryCode: string,
    isAvailable: boolean
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('affiliate_country_mappings')
      .update({ is_available: isAvailable })
      .match({
        affiliate_program_id: affiliateId,
        country_code: countryCode,
      });

    return !error;
  }

  /**
   * Get available affiliates for a country
   */
  async getCountryAffiliates(
    countryCode: string,
    recommendedOnly: boolean = false
  ): Promise<
    Array<{
      affiliate_id: string;
      is_available: boolean;
      is_recommended: boolean;
      avg_conversion_rate: number;
      avg_epc: number;
    }>
  > {
    let query = this.supabase
      .from('affiliate_country_mappings')
      .select(`
        affiliate_program_id,
        is_available,
        is_recommended,
        avg_conversion_rate,
        avg_epc,
        affiliate_programs(name)
      `)
      .eq('country_code', countryCode)
      .eq('is_available', true);

    if (recommendedOnly) {
      query = query.eq('is_recommended', true);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error(`Failed to fetch country affiliates: ${error?.message}`);
      return [];
    }

    return data.map((row: any) => ({
      affiliate_id: row.affiliate_programs?.name || '',
      is_available: row.is_available,
      is_recommended: row.is_recommended,
      avg_conversion_rate: row.avg_conversion_rate || 0,
      avg_epc: row.avg_epc || 0,
    }));
  }
}
