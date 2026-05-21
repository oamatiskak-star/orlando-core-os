"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const logger_1 = require("./logger");
class HttpClient {
    constructor(config = {}) {
        this.timeout = config.timeout || 10000;
        this.retries = config.retries || 3;
        this.userAgent = config.userAgent || 'Orlando-AcquisitionBot/1.0 (+https://orlando.local/scraper)';
    }
    async get(url, attempt = 1) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json',
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                if (response.status === 429 && attempt < this.retries) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
                    logger_1.logger.warn(`Rate limited. Waiting ${waitMs}ms before retry.`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    return this.get(url, attempt + 1);
                }
                if (response.status >= 500 && attempt < this.retries) {
                    const waitMs = Math.pow(2, attempt) * 1000;
                    logger_1.logger.warn(`Server error (${response.status}). Retrying in ${waitMs}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    return this.get(url, attempt + 1);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (attempt < this.retries) {
                const waitMs = Math.pow(2, attempt) * 1000;
                logger_1.logger.warn(`Fetch failed: ${message}. Retrying in ${waitMs}ms`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                return this.get(url, attempt + 1);
            }
            logger_1.logger.error(`Failed to fetch ${url} after ${this.retries} attempts`, { error: message });
            return null;
        }
    }
    async post(url, body, attempt = 1) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'User-Agent': this.userAgent,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                if (response.status === 429 && attempt < this.retries) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    return this.post(url, body, attempt + 1);
                }
                if (response.status >= 500 && attempt < this.retries) {
                    const waitMs = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    return this.post(url, body, attempt + 1);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (attempt < this.retries) {
                const waitMs = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, waitMs));
                return this.post(url, body, attempt + 1);
            }
            logger_1.logger.error(`Failed to POST ${url} after ${this.retries} attempts`, { error: message });
            return null;
        }
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=http-client.js.map