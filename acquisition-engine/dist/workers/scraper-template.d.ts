import { ScraperBase } from '../lib/scraper-base';
import { ScraperResult, RawDeal } from '../lib/types';
/**
 * Template for implementing scrapers.
 * Each scraper should:
 * 1. Extend ScraperBase with config
 * 2. Implement async run() method
 * 3. Use retryWithBackoff for external calls
 * 4. Insert deals via insertDeals()
 * 5. Return ScraperResult
 */
export declare class TemplateScraperWorker extends ScraperBase {
    private httpClient;
    private robotsChecker;
    constructor();
    run(): Promise<ScraperResult>;
    private fetchDeals;
    protected mapToRawDeal(apiItem: Record<string, unknown>): RawDeal;
}
export declare function runTemplateScraper(): Promise<{
    agent: string;
    itemsFound: number;
    itemsInserted: number;
}>;
//# sourceMappingURL=scraper-template.d.ts.map