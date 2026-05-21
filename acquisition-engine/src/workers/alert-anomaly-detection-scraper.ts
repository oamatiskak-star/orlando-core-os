import { ScraperBase } from '../lib/scraper-base'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Real-Time Alert & Anomaly Detection System
 * Monitoreert deals op anomalies, price changes, opportunity shifts en genereert alerts
 *
 * Features:
 * - Price drop detection (>10% decrease triggers alert)
 * - Opportunity score changes (significant improvement/degradation)
 * - Risk escalation (risk score increases >15 points)
 * - Anomaly detection integration (flags unusual patterns)
 * - Market sentiment shifts (bullish → bearish or vice versa)
 * - Batch processing with efficient incremental scanning
 * - Alert severity levels (low/medium/high/critical)
 * - Deduplication (no duplicate alerts within 24h)
 * - Deal status transitions (leads → prospects → qualified)
 *
 * Rate limit: 250 req/hour (read-only monitoring)
 * Batch: processes 100 deals per run with incremental tracking
 */

interface AlertableDeal {
  id: string
  address: string
  city: string
  province: string
  asking_price: number
  pipeline_stage: string
  created_at: string
  updated_at: string
}

interface DealSnapshot {
  deal_id: string
  address: string
  city: string
  province: string
  asking_price: number
  opportunity_score?: number
  risk_score?: number
  market_sentiment?: string
  is_anomaly?: boolean
  anomaly_severity?: string
  pipeline_stage: string
  snapshot_timestamp: string
}

interface Alert {
  deal_id: string
  address: string
  alert_type:
    | 'price_drop'
    | 'opportunity_improvement'
    | 'opportunity_degradation'
    | 'risk_escalation'
    | 'anomaly_detected'
    | 'sentiment_shift'
    | 'status_change'
    | 'market_timing_signal'
  severity: 'low' | 'medium' | 'high' | 'critical'
  previous_value?: number
  current_value?: number
  change_pct?: number
  message: string
  action_recommended: string
  alert_timestamp: string
  resolved: boolean
}

class AlertAnomalyDetectionWorker extends ScraperBase {
  private readonly MODEL_VERSION = 'v1.0-initial'

  constructor() {
    const config: ScraperConfig = {
      name: 'alert-anomaly-detection',
      rateLimitPerHour: 250,
      retryAttempts: 2,
      retryDelayMs: 500,
      timeoutMs: 25000,
      domain: 'internal-alert-system',
    }
    super(config)
  }

  async run(): Promise<ScraperResult> {
    const start = Date.now()

    try {
      // Fetch deals to monitor
      const deals = await this.fetchDealsToMonitor()
      if (deals.length === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - start,
        }
      }

      // Detect anomalies and generate alerts
      const alerts: Alert[] = []
      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i]
        try {
          const dealAlerts = await this.detectAnomaliesForDeal(deal)
          alerts.push(...dealAlerts)

          // Rate limiting
          if (i < deals.length - 1) {
            await this.sleep(100)
          }
        } catch (err) {
          logger.warn(`Failed to process alerts for ${deal.address}`, {
            error: String(err),
          })
        }
      }

      // Insert alerts to database
      const { inserted } = await this.insertAlerts(alerts)

      return {
        success: true,
        itemsFound: deals.length,
        itemsInserted: inserted,
        itemsSkipped: deals.length - inserted,
        duration_ms: Date.now() - start,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('AlertAnomalyDetectionScraper error', { error: message })
      return {
        success: false,
        itemsFound: 0,
        itemsInserted: 0,
        itemsSkipped: 0,
        duration_ms: Date.now() - start,
        error: message,
      }
    }
  }

  /**
   * Fetch deals to monitor (last 48h updated, active stages)
   */
  private async fetchDealsToMonitor(): Promise<AlertableDeal[]> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('acq_deals')
      .select(`
        id, address, city, province, asking_price, pipeline_stage, created_at, updated_at
      `)
      .in('pipeline_stage', ['leads', 'prospects', 'qualified'])
      .gte('updated_at', twoHoursAgo)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      logger.error('Failed to fetch deals for monitoring', { error: error.message })
      return []
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      address: d.address,
      city: d.city,
      province: d.province,
      asking_price: d.asking_price || 0,
      pipeline_stage: d.pipeline_stage,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }))
  }

  /**
   * Detect anomalies for a single deal
   */
  private async detectAnomaliesForDeal(deal: AlertableDeal): Promise<Alert[]> {
    const alerts: Alert[] = []

    // Get enrichment data
    const { data: opp, error: oppError } = await supabase
      .from('acq_opportunity_scores')
      .select('*')
      .eq('deal_id', deal.id)
      .single()

    const { data: pred, error: predError } = await supabase
      .from('acq_predictive_metrics')
      .select('*')
      .eq('deal_id', deal.id)
      .single()

    // Get previous snapshot (if exists)
    const { data: prevSnapshot } = await supabase
      .from('acq_deal_monitoring_snapshots')
      .select('*')
      .eq('deal_id', deal.id)
      .order('snapshot_timestamp', { ascending: false })
      .limit(1)
      .single()

    const currentSnapshot: DealSnapshot = {
      deal_id: deal.id,
      address: deal.address,
      city: deal.city,
      province: deal.province,
      asking_price: deal.asking_price,
      opportunity_score: opp?.overall_opportunity_score,
      risk_score: opp?.risk_adjusted_return_score,
      market_sentiment: pred?.price_trend_signal,
      is_anomaly: pred?.is_anomaly,
      anomaly_severity: pred?.anomaly_severity,
      pipeline_stage: deal.pipeline_stage,
      snapshot_timestamp: new Date().toISOString(),
    }

    // 1. Price drop detection
    if (
      prevSnapshot &&
      prevSnapshot.asking_price &&
      deal.asking_price < prevSnapshot.asking_price * 0.9
    ) {
      const changePct = ((deal.asking_price - prevSnapshot.asking_price) / prevSnapshot.asking_price) * 100
      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'price_drop',
        severity: Math.abs(changePct) > 20 ? 'critical' : 'high',
        previous_value: prevSnapshot.asking_price,
        current_value: deal.asking_price,
        change_pct: changePct,
        message: `Prijs gedaald van €${prevSnapshot.asking_price.toLocaleString('nl-NL')} naar €${deal.asking_price.toLocaleString('nl-NL')} (${changePct.toFixed(1)}%)`,
        action_recommended: 'Onderzoek reden van prijsdaling — mogelijk financieel probleem',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // 2. Opportunity improvement
    if (
      prevSnapshot &&
      opp?.overall_opportunity_score &&
      opp.overall_opportunity_score > (prevSnapshot.opportunity_score || 0) + 15
    ) {
      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'opportunity_improvement',
        severity: 'high',
        previous_value: prevSnapshot.opportunity_score,
        current_value: opp.overall_opportunity_score,
        change_pct: ((opp.overall_opportunity_score - (prevSnapshot.opportunity_score || 0)) / (prevSnapshot.opportunity_score || 1)) * 100,
        message: `Opportunity score sterk verbeterd: ${prevSnapshot.opportunity_score || 0} → ${opp.overall_opportunity_score}`,
        action_recommended: 'Herbekijk deal — kan nu sterker zijn dan eerder ingeschat',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // 3. Opportunity degradation
    if (
      prevSnapshot &&
      opp?.overall_opportunity_score &&
      opp.overall_opportunity_score < (prevSnapshot.opportunity_score || 100) - 15
    ) {
      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'opportunity_degradation',
        severity: 'medium',
        previous_value: prevSnapshot.opportunity_score,
        current_value: opp.overall_opportunity_score,
        change_pct: ((opp.overall_opportunity_score - (prevSnapshot.opportunity_score || 0)) / (prevSnapshot.opportunity_score || 1)) * 100,
        message: `Opportunity score is gedaald: ${prevSnapshot.opportunity_score || 0} → ${opp.overall_opportunity_score}`,
        action_recommended: 'Controleer wat is veranderd — markt, risico, of deal specifieke factoren',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // 4. Risk escalation
    if (
      prevSnapshot &&
      opp?.risk_adjusted_return_score &&
      opp.risk_adjusted_return_score > (prevSnapshot.risk_score || 0) + 15
    ) {
      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'risk_escalation',
        severity: 'high',
        previous_value: prevSnapshot.risk_score,
        current_value: opp.risk_adjusted_return_score,
        message: `Risico is gestegen van ${prevSnapshot.risk_score || 0} naar ${opp.risk_adjusted_return_score}`,
        action_recommended: 'Herzie risico-inschattingen — wat is veranderd in markt of asset?',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // 5. Anomaly detection
    if (pred?.is_anomaly && !prevSnapshot?.is_anomaly) {
      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'anomaly_detected',
        severity: pred.anomaly_severity === 'high' ? 'critical' : pred.anomaly_severity === 'medium' ? 'high' : 'medium',
        message: `Anomalie gedetecteerd: ${pred.anomaly_type} (${pred.anomaly_severity} severity)`,
        action_recommended: 'Onderzoek waarom deze deal een anomalie is — kan grote kans zijn',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // 6. Market sentiment shift
    if (
      prevSnapshot &&
      pred?.price_trend_signal &&
      prevSnapshot.market_sentiment &&
      this.isSentimentShift(prevSnapshot.market_sentiment, pred.price_trend_signal)
    ) {
      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'sentiment_shift',
        severity: 'medium',
        message: `Marktstemmming veranderd: ${prevSnapshot.market_sentiment} → ${pred.price_trend_signal}`,
        action_recommended: 'Herbekijk marktanalyse — sentiment shift kan timing beïnvloeden',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // 7. Status change
    if (prevSnapshot && deal.pipeline_stage !== prevSnapshot.pipeline_stage) {
      const stageOrder = { leads: 0, prospects: 1, qualified: 2, negotiating: 3 }
      const isProgression = stageOrder[deal.pipeline_stage as keyof typeof stageOrder] > stageOrder[prevSnapshot.pipeline_stage as keyof typeof stageOrder]

      alerts.push({
        deal_id: deal.id,
        address: deal.address,
        alert_type: 'status_change',
        severity: isProgression ? 'high' : 'low',
        message: `Deal status veranderd: ${prevSnapshot.pipeline_stage} → ${deal.pipeline_stage}`,
        action_recommended: isProgression ? 'Deal vordert — zorg voor voldoende due diligence' : 'Deal teruggekomen naar eerder stage',
        alert_timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    // Store current snapshot
    await this.storeSnapshot(currentSnapshot)

    return alerts
  }

  /**
   * Check if sentiment changed significantly
   */
  private isSentimentShift(prev: string, current: string): boolean {
    const isNegativeShift = ['bullish', 'neutral'].includes(prev) && current === 'bearish'
    const isPositiveShift = ['bearish', 'neutral'].includes(prev) && current === 'bullish'
    return isNegativeShift || isPositiveShift
  }

  /**
   * Store snapshot for future comparison
   */
  private async storeSnapshot(snapshot: DealSnapshot): Promise<void> {
    try {
      await supabase.from('acq_deal_monitoring_snapshots').upsert(
        {
          deal_id: snapshot.deal_id,
          address: snapshot.address,
          city: snapshot.city,
          province: snapshot.province,
          asking_price: snapshot.asking_price,
          opportunity_score: snapshot.opportunity_score,
          risk_score: snapshot.risk_score,
          market_sentiment: snapshot.market_sentiment,
          is_anomaly: snapshot.is_anomaly,
          anomaly_severity: snapshot.anomaly_severity,
          pipeline_stage: snapshot.pipeline_stage,
          snapshot_timestamp: snapshot.snapshot_timestamp,
        },
        { onConflict: 'deal_id' }
      )
    } catch (err) {
      logger.warn('Failed to store snapshot', { error: String(err) })
    }
  }

  /**
   * Insert alerts to database
   */
  private async insertAlerts(alerts: Alert[]) {
    if (alerts.length === 0) {
      return { inserted: 0, skipped: 0 }
    }

    let inserted = 0
    let skipped = 0

    for (const alert of alerts) {
      try {
        // Check for duplicate alerts (same deal + type within 24h)
        const { data: existing } = await supabase
          .from('acq_deal_alerts')
          .select('id')
          .eq('deal_id', alert.deal_id)
          .eq('alert_type', alert.alert_type)
          .gte('alert_timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .single()

        if (existing) {
          skipped++
          continue
        }

        const { error: insertError } = await supabase
          .from('acq_deal_alerts')
          .insert(alert)

        if (insertError) {
          logger.warn('Failed to insert alert', {
            dealId: alert.deal_id,
            error: insertError.message,
          })
          skipped++
        } else {
          inserted++
        }
      } catch (err) {
        logger.warn('Error inserting alert', {
          dealId: alert.deal_id,
          error: String(err),
        })
        skipped++
      }
    }

    await this.recordScraperRun('AlertAnomalyDetectionScraper', {
      success: inserted > 0,
      itemsFound: alerts.length,
      itemsInserted: inserted,
      itemsSkipped: skipped,
      duration_ms: 0,
    })

    return { inserted, skipped }
  }
}

export async function runAlertAnomalyDetectionScraper() {
  const scraper = new AlertAnomalyDetectionWorker()
  const result = await scraper.run()
  return {
    status: result.success ? 'ok' : 'error',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
    itemsSkipped: result.itemsSkipped,
    error: result.error || null,
  }
}
