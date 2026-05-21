import { ScraperConfig, ScraperResult, RawDeal } from './types';
declare class RateLimiter {
    private buckets;
    checkLimit(domain: string, maxPerHour: number): Promise<boolean>;
    increment(domain: string): void;
    getStatus(domain: string, maxPerHour: number): {
        used: number;
        remaining: number;
        resetAt: number;
    };
}
export declare class ScraperBase {
    protected config: ScraperConfig;
    protected rateLimiter: RateLimiter;
    protected maxRetries: number;
    constructor(config: ScraperConfig);
    sleep(ms: number): Promise<void>;
    retryWithBackoff<T>(fn: () => Promise<T>, context: string): Promise<T | null>;
    protected insertDeals(deals: RawDeal[]): Promise<{
        inserted: number;
        skipped: number;
    }>;
    recordScraperRun(agentName: string, result: ScraperResult): Promise<void>;
    getRateLimitStatus(): {
        used: number;
        remaining: number;
        resetAt: number;
    };
}
export {};
//# sourceMappingURL=scraper-base.d.ts.map