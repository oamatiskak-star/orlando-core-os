export declare class RobotsChecker {
    private cache;
    private httpClient;
    private botName;
    constructor();
    canScrape(domain: string): Promise<{
        allowed: boolean;
        crawlDelay: number;
    }>;
    private parseRobots;
    clearCache(): void;
}
//# sourceMappingURL=robots-checker.d.ts.map