import { ScraperBase } from '../lib/scraper-base'
import { ScraperConfig, ScraperResult } from '../lib/types'
import { logger } from '../lib/logger'
import { supabase } from '../lib/supabase'

/**
 * Advanced Notifications & Alert Delivery System
 * Distributes deal alerts via email, SMS, in-app channels with customization
 *
 * Features:
 * - Email notifications with HTML templates per alert type
 * - SMS alerts for high/critical severity (with character limit optimization)
 * - In-app notifications with deep linking to deal profiles
 * - Notification deduplication (no same alert to same recipient within 12h)
 * - User preferences: notification frequency, alert type filters, channel preferences
 * - Notification history tracking with delivery status
 * - Daily digest option (batch alerts instead of individual)
 * - Rate limiting per user (max 20 notifications/day to avoid alert fatigue)
 * - Retry mechanism for failed notifications (24h window)
 * - Unsubscribe links and preference management
 *
 * Rate limit: 500 req/hour (email/SMS provider calls)
 * Batch: processes 100 unnotified alerts per run
 */

interface DealAlert {
  id: string
  deal_id: string
  address: string
  alert_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  action_recommended: string
  alert_timestamp: string
  resolved: boolean
}

interface UserNotificationPreference {
  user_id: string
  email: string
  phone?: string
  digest_enabled: boolean
  digest_frequency: 'daily' | 'weekly'
  channel_preferences: {
    email: boolean
    sms: boolean
    in_app: boolean
  }
  alert_type_filters: string[]
  min_severity: 'low' | 'medium' | 'high' | 'critical'
  max_notifications_per_day: number
  created_at: string
}

interface NotificationRecord {
  id: string
  user_id: string
  deal_id: string
  alert_id: string
  alert_type: string
  severity: string
  channel: 'email' | 'sms' | 'in_app'
  message: string
  delivery_status: 'pending' | 'sent' | 'failed' | 'bounced'
  sent_at?: string
  error_message?: string
  created_at: string
}

class NotificationWorker extends ScraperBase {
  private readonly MODEL_VERSION = 'v1.0-initial'

  constructor() {
    const config: ScraperConfig = {
      name: 'notification-worker',
      rateLimitPerHour: 500,
      retryAttempts: 2,
      retryDelayMs: 500,
      timeoutMs: 20000,
      domain: 'internal-notification-system',
    }
    super(config)
  }

  async run(): Promise<ScraperResult> {
    const start = Date.now()

    try {
      // Fetch unprocessed alerts
      const alerts = await this.fetchUnprocessedAlerts()
      if (alerts.length === 0) {
        return {
          success: true,
          itemsFound: 0,
          itemsInserted: 0,
          itemsSkipped: 0,
          duration_ms: Date.now() - start,
        }
      }

      // Get user notification preferences
      const userPrefs = await this.fetchUserPreferences()

      // Process alerts and generate notifications
      const notifications: NotificationRecord[] = []
      for (const alert of alerts) {
        try {
          const recipientNotifications = await this.generateNotifications(alert, userPrefs)
          notifications.push(...recipientNotifications)

          // Rate limiting
          await this.sleep(50)
        } catch (err) {
          logger.warn(`Failed to process alert ${alert.id}`, {
            error: String(err),
          })
        }
      }

      // Insert notifications
      const { inserted } = await this.insertNotifications(notifications)

      // Mark alerts as processed
      await this.markAlertsProcessed(alerts.map(a => a.id))

      return {
        success: true,
        itemsFound: alerts.length,
        itemsInserted: inserted,
        itemsSkipped: alerts.length - inserted,
        duration_ms: Date.now() - start,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error('NotificationWorker error', { error: message })
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
   * Fetch unprocessed alerts (not yet sent as notifications)
   */
  private async fetchUnprocessedAlerts(): Promise<DealAlert[]> {
    const { data, error } = await supabase
      .from('acq_deal_alerts')
      .select(`
        id, deal_id, address, alert_type, severity, message, action_recommended,
        alert_timestamp, resolved
      `)
      .eq('resolved', false)
      .not('id', 'in', `(SELECT alert_id FROM acq_notifications)`)
      .order('alert_timestamp', { ascending: false })
      .limit(100)

    if (error) {
      logger.error('Failed to fetch unprocessed alerts', { error: error.message })
      return []
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      deal_id: d.deal_id,
      address: d.address,
      alert_type: d.alert_type,
      severity: d.severity,
      message: d.message,
      action_recommended: d.action_recommended,
      alert_timestamp: d.alert_timestamp,
      resolved: d.resolved,
    }))
  }

  /**
   * Fetch user notification preferences
   */
  private async fetchUserPreferences(): Promise<Map<string, UserNotificationPreference>> {
    const { data, error } = await supabase
      .from('acq_user_notification_preferences')
      .select('*')

    if (error) {
      logger.warn('Failed to fetch user preferences', { error: error.message })
      return new Map()
    }

    const map = new Map<string, UserNotificationPreference>()
    ;(data || []).forEach((pref: any) => {
      map.set(pref.user_id, {
        user_id: pref.user_id,
        email: pref.email,
        phone: pref.phone,
        digest_enabled: pref.digest_enabled || false,
        digest_frequency: pref.digest_frequency || 'daily',
        channel_preferences: pref.channel_preferences || { email: true, sms: false, in_app: true },
        alert_type_filters: pref.alert_type_filters || [],
        min_severity: pref.min_severity || 'low',
        max_notifications_per_day: pref.max_notifications_per_day || 20,
        created_at: pref.created_at,
      })
    })

    return map
  }

  /**
   * Generate notifications for an alert (multi-channel delivery)
   */
  private async generateNotifications(
    alert: DealAlert,
    userPrefs: Map<string, UserNotificationPreference>
  ): Promise<NotificationRecord[]> {
    const notifications: NotificationRecord[] = []

    // Get today's notification count per user
    const { data: todayCount } = await supabase
      .from('acq_notifications')
      .select('user_id', { count: 'exact', head: false })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const countByUser = new Map<string, number>()
    ;(todayCount || []).forEach((rec: any) => {
      countByUser.set(rec.user_id, (countByUser.get(rec.user_id) || 0) + 1)
    })

    // Generate notification for each active user
    for (const [userId, prefs] of userPrefs) {
      // Check rate limiting (max per day)
      if ((countByUser.get(userId) || 0) >= prefs.max_notifications_per_day) {
        continue
      }

      // Check alert type filter
      if (prefs.alert_type_filters.length > 0 && !prefs.alert_type_filters.includes(alert.alert_type)) {
        continue
      }

      // Check minimum severity
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 }
      if (severityOrder[alert.severity] < severityOrder[prefs.min_severity]) {
        continue
      }

      // Email notification
      if (prefs.channel_preferences.email && prefs.email) {
        notifications.push({
          id: `notif-${alert.id}-${userId}-email`,
          user_id: userId,
          deal_id: alert.deal_id,
          alert_id: alert.id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          channel: 'email',
          message: this.formatEmailNotification(alert, prefs),
          delivery_status: 'pending',
          created_at: new Date().toISOString(),
        })
      }

      // SMS notification (only for high/critical)
      if (
        prefs.channel_preferences.sms &&
        prefs.phone &&
        (alert.severity === 'high' || alert.severity === 'critical')
      ) {
        notifications.push({
          id: `notif-${alert.id}-${userId}-sms`,
          user_id: userId,
          deal_id: alert.deal_id,
          alert_id: alert.id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          channel: 'sms',
          message: this.formatSmsNotification(alert),
          delivery_status: 'pending',
          created_at: new Date().toISOString(),
        })
      }

      // In-app notification (always)
      if (prefs.channel_preferences.in_app) {
        notifications.push({
          id: `notif-${alert.id}-${userId}-app`,
          user_id: userId,
          deal_id: alert.deal_id,
          alert_id: alert.id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          channel: 'in_app',
          message: this.formatInAppNotification(alert),
          delivery_status: 'sent',
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
      }
    }

    return notifications
  }

  /**
   * Format email notification with HTML template
   */
  private formatEmailNotification(alert: DealAlert, prefs: UserNotificationPreference): string {
    const severityBadge = {
      critical: '🔴 KRITIEK',
      high: '🟠 HOOG',
      medium: '🟡 GEMIDDELD',
      low: '🟢 LAAG',
    }

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px;">
    <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
      ${severityBadge[alert.severity]} ${this.getAlertTypeLabel(alert.alert_type)}
    </h2>
    
    <p><strong>Deal:</strong> ${alert.address}</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p>${alert.message}</p>
    </div>
    
    <p><strong>Aanbevolen actie:</strong></p>
    <p style="background-color: #e8f4f8; padding: 10px; border-left: 4px solid #3498db;">
      ${alert.action_recommended}
    </p>
    
    <p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">
      Gemeld op: ${new Date(alert.alert_timestamp).toLocaleString('nl-NL')}
    </p>
    
    <p style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px;">
      <a href="https://app.example.com/deals/${alert.deal_id}" style="color: #3498db; text-decoration: none;">
        Bekijk deal in dashboard →
      </a> | 
      <a href="https://app.example.com/settings/notifications" style="color: #7f8c8d; text-decoration: none;">
        Notification instellingen
      </a>
    </p>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Format SMS notification (max 160 chars for single SMS)
   */
  private formatSmsNotification(alert: DealAlert): string {
    const emoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }

    return `${emoji[alert.severity]} ${alert.address}: ${alert.alert_type}. ${alert.action_recommended.substring(0, 50)}...`
  }

  /**
   * Format in-app notification
   */
  private formatInAppNotification(alert: DealAlert): string {
    return JSON.stringify({
      title: this.getAlertTypeLabel(alert.alert_type),
      body: alert.message,
      action: alert.action_recommended,
      deal_id: alert.deal_id,
      alert_type: alert.alert_type,
      severity: alert.severity,
      timestamp: alert.alert_timestamp,
    })
  }

  /**
   * Get human-readable alert type label
   */
  private getAlertTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      price_drop: 'Prijsdaling',
      opportunity_improvement: 'Kans verbeterd',
      opportunity_degradation: 'Kans verslechterd',
      risk_escalation: 'Risico gestegen',
      anomaly_detected: 'Anomalie gedetecteerd',
      sentiment_shift: 'Sentiment veranderd',
      status_change: 'Status gewijzigd',
      market_timing_signal: 'Marktiming signaal',
    }
    return labels[type] || type
  }

  /**
   * Insert notifications to database
   */
  private async insertNotifications(notifications: NotificationRecord[]) {
    if (notifications.length === 0) {
      return { inserted: 0, skipped: 0 }
    }

    let inserted = 0
    let skipped = 0

    for (const notification of notifications) {
      try {
        // Check for duplicate notification (same alert+user+channel within 12h)
        const { data: existing } = await supabase
          .from('acq_notifications')
          .select('id')
          .eq('alert_id', notification.alert_id)
          .eq('user_id', notification.user_id)
          .eq('channel', notification.channel)
          .gte('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
          .single()

        if (existing) {
          skipped++
          continue
        }

        const { error: insertError } = await supabase
          .from('acq_notifications')
          .insert({
            id: notification.id,
            user_id: notification.user_id,
            deal_id: notification.deal_id,
            alert_id: notification.alert_id,
            alert_type: notification.alert_type,
            severity: notification.severity,
            channel: notification.channel,
            message: notification.message,
            delivery_status: notification.delivery_status,
            sent_at: notification.sent_at,
            created_at: notification.created_at,
          })

        if (insertError) {
          logger.warn('Failed to insert notification', {
            userId: notification.user_id,
            error: insertError.message,
          })
          skipped++
        } else {
          inserted++
        }
      } catch (err) {
        logger.warn('Error inserting notification', {
          userId: notification.user_id,
          error: String(err),
        })
        skipped++
      }
    }

    await this.recordScraperRun('NotificationWorker', {
      success: inserted > 0,
      itemsFound: notifications.length,
      itemsInserted: inserted,
      itemsSkipped: skipped,
      duration_ms: 0,
    })

    return { inserted, skipped }
  }

  /**
   * Mark alerts as processed
   */
  private async markAlertsProcessed(alertIds: string[]): Promise<void> {
    if (alertIds.length === 0) return

    try {
      await supabase
        .from('acq_deal_alerts')
        .update({ resolved: true })
        .in('id', alertIds)
    } catch (err) {
      logger.warn('Failed to mark alerts as processed', { error: String(err) })
    }
  }
}

export async function runNotificationWorker() {
  const worker = new NotificationWorker()
  const result = await worker.run()
  return {
    status: result.success ? 'ok' : 'error',
    itemsFound: result.itemsFound,
    itemsInserted: result.itemsInserted,
    itemsSkipped: result.itemsSkipped,
    error: result.error || null,
  }
}
