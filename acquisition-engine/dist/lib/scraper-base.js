"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperBase = void 0;
const logger_1 = require("./logger");
const supabase_1 = require("./supabase");
class RateLimiter {
    constructor() {
        this.buckets = new Map();
    }
    async checkLimit(domain, maxPerHour) {
        const now = Date.now();
        const bucket = this.buckets.get(domain);
        if (!bucket || now > bucket.resetAt) {
            this.buckets.set(domain, {
                domain,
                count: 0,
                resetAt: now + 3600000, // 1 hour
            });
            return true;
        }
        if (bucket.count >= maxPerHour) {
            const waitMs = bucket.resetAt - now;
            logger_1.logger.warn(`Rate limit hit for ${domain}. Wait ${Math.round(waitMs / 1000)}s`);
            return false;
        }
        bucket.count += 1;
        return true;
    }
    increment(domain) {
        const bucket = this.buckets.get(domain);
        if (bucket) {
            bucket.count += 1;
        }
    }
    getStatus(domain, maxPerHour) {
        const bucket = this.buckets.get(domain);
        if (!bucket) {
            return { used: 0, remaining: maxPerHour, resetAt: Date.now() + 3600000 };
        }
        return {
            used: bucket.count,
            remaining: Math.max(0, maxPerHour - bucket.count),
            resetAt: bucket.resetAt,
        };
    }
}
class ScraperBase {
    constructor(config) {
        this.config = config;
        this.rateLimiter = new RateLimiter();
        this.maxRetries = config.retryAttempts || 3;
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async retryWithBackoff(fn, context) {
        let lastError = null;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const allowed = await this.rateLimiter.checkLimit(this.config.domain, this.config.rateLimitPerHour);
                if (!allowed) {
                    await this.sleep(this.config.retryDelayMs * 4);
                    continue;
                }
                const result = await Promise.race([
                    fn(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs)),
                ]);
                this.rateLimiter.increment(this.config.domain);
                return result;
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                const backoffMs = Math.pow(2, attempt) * this.config.retryDelayMs;
                if (attempt < this.maxRetries) {
                    logger_1.logger.warn(`${context} attempt ${attempt + 1} failed. Retrying in ${backoffMs}ms.`, {
                        error: lastError.message,
                    });
                    await this.sleep(backoffMs);
                }
            }
        }
        logger_1.logger.error(`${context} failed after ${this.maxRetries + 1} attempts`, {
            error: lastError?.message,
        });
        return null;
    }
    async insertDeals(deals) {
        let inserted = 0;
        let skipped = 0;
        for (const deal of deals) {
            try {
                const { data: existing } = await supabase_1.supabase
                    .from('acq_deals')
                    .select('id')
                    .eq('source', deal.source)
                    .eq('source_url', deal.source_url)
                    .single();
                if (existing) {
                    skipped += 1;
                    continue;
                }
                const { error } = await supabase_1.supabase.from('acq_deals').insert({
                    title: deal.title,
                    address: deal.address,
                    city: deal.city,
                    province: deal.province,
                    asking_price: deal.price,
                    area_m2: deal.area_m2,
                    build_year: deal.build_year,
                    energy_label: deal.energy_label,
                    object_type: deal.type,
                    source: deal.source,
                    source_url: deal.source_url,
                    pipeline_stage: 'radar',
                    status: 'actief',
                    notes: JSON.stringify(deal.raw_data || {}),
                    created_at: new Date().toISOString(),
                });
                if (error) {
                    logger_1.logger.error(`Failed to insert deal ${deal.id}`, { error: error.message });
                    skipped += 1;
                }
                else {
                    inserted += 1;
                }
            }
            catch (err) {
                logger_1.logger.error(`Error processing deal ${deal.id}`, { error: String(err) });
                skipped += 1;
            }
        }
        return { inserted, skipped };
    }
    async recordScraperRun(agentName, result) {
        try {
            await supabase_1.supabase.from('acq_scan_jobs').insert({
                agent_name: agentName,
                job_type: `${this.config.name}-scan`,
                status: result.success ? 'done' : 'failed',
                payload: { itemsFound: result.itemsFound },
                result_count: result.itemsInserted,
                error_msg: result.error || null,
                created_at: new Date().toISOString(),
                started_at: new Date(Date.now() - result.duration_ms).toISOString(),
                finished_at: new Date().toISOString(),
            });
        }
        catch (err) {
            logger_1.logger.error(`Failed to record scraper run`, { error: String(err) });
        }
    }
    getRateLimitStatus() {
        return this.rateLimiter.getStatus(this.config.domain, this.config.rateLimitPerHour);
    }
}
exports.ScraperBase = ScraperBase;
//# sourceMappingURL=scraper-base.js.map