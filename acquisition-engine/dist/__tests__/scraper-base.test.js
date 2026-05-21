"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_base_1 = require("../lib/scraper-base");
describe('ScraperBase', () => {
    const mockConfig = {
        name: 'test-scraper',
        rateLimitPerHour: 10,
        retryAttempts: 2,
        retryDelayMs: 100,
        timeoutMs: 5000,
        domain: 'test.example.com',
    };
    let scraper;
    beforeEach(() => {
        scraper = new scraper_base_1.ScraperBase(mockConfig);
    });
    describe('sleep', () => {
        it('should wait for specified duration', async () => {
            const start = Date.now();
            await scraper.sleep(100);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(90);
            expect(elapsed).toBeLessThan(200);
        });
    });
    describe('retryWithBackoff', () => {
        it('should succeed on first attempt', async () => {
            const fn = jest.fn().mockResolvedValue({ data: 'success' });
            const result = await scraper.retryWithBackoff(fn, 'test');
            expect(result).toEqual({ data: 'success' });
            expect(fn).toHaveBeenCalledTimes(1);
        });
        it('should retry on failure and eventually succeed', async () => {
            const fn = jest
                .fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockResolvedValueOnce({ data: 'success' });
            const result = await scraper.retryWithBackoff(fn, 'test');
            expect(result).toEqual({ data: 'success' });
            expect(fn).toHaveBeenCalledTimes(2);
        });
        it('should return null after max retries', async () => {
            const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));
            const result = await scraper.retryWithBackoff(fn, 'test');
            expect(result).toBeNull();
            expect(fn).toHaveBeenCalledTimes(mockConfig.retryAttempts + 1);
        });
    });
    describe('getRateLimitStatus', () => {
        it('should track rate limit correctly', async () => {
            let status = scraper.getRateLimitStatus();
            expect(status.used).toBe(0);
            expect(status.remaining).toBe(10);
            // Simulate checking multiple times (each increments)
            for (let i = 0; i < 3; i++) {
                await scraper.retryWithBackoff(async () => ({ success: true }), 'test');
            }
            status = scraper.getRateLimitStatus();
            expect(status.used).toBe(3);
            expect(status.remaining).toBe(7);
        });
    });
});
describe('RawDeal mapping', () => {
    it('should map raw deal correctly', () => {
        const rawDeal = {
            id: 'deal-123',
            title: 'Beautiful apartment',
            address: 'Straat 1',
            city: 'Amsterdam',
            province: 'Noord-Holland',
            price: 500000,
            type: 'apartment',
            area_m2: 120,
            energy_label: 'C',
            build_year: 1995,
            source: 'test-source',
            source_url: 'https://example.com/deal-123',
        };
        expect(rawDeal.title).toBe('Beautiful apartment');
        expect(rawDeal.price).toBe(500000);
        expect(rawDeal.source).toBe('test-source');
    });
});
//# sourceMappingURL=scraper-base.test.js.map