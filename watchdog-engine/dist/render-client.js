"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderClient = void 0;
const axios_1 = __importDefault(require("axios"));
class RenderClient {
    http;
    constructor(apiKey) {
        this.http = axios_1.default.create({
            baseURL: 'https://api.render.com/v1',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 20_000
        });
    }
    async listServices() {
        const out = [];
        let cursor;
        for (let page = 0; page < 10; page++) {
            const params = { limit: 100 };
            if (cursor)
                params.cursor = cursor;
            const { data } = await this.http.get('/services', { params });
            if (!Array.isArray(data) || data.length === 0)
                break;
            for (const row of data) {
                out.push(row.service);
                cursor = row.cursor;
            }
            if (data.length < 100)
                break;
        }
        return out;
    }
    async listDeploys(serviceId, limit = 5) {
        const { data } = await this.http.get(`/services/${serviceId}/deploys`, {
            params: { limit }
        });
        return data.map((row) => row.deploy);
    }
    async restartService(serviceId) {
        await this.http.post(`/services/${serviceId}/restart`);
    }
    async triggerDeploy(serviceId, opts = {}) {
        const body = {};
        if (opts.clearCache)
            body.clearCache = 'clear';
        const { data } = await this.http.post(`/services/${serviceId}/deploys`, body);
        return data;
    }
    async fetchLogs(opts) {
        const params = {
            ownerId: opts.ownerId,
            resource: opts.resourceId,
            direction: 'backward',
            limit: opts.limit ?? 60
        };
        if (opts.type)
            params.type = opts.type;
        if (opts.startTime)
            params.startTime = opts.startTime.toISOString();
        if (opts.endTime)
            params.endTime = opts.endTime.toISOString();
        const { data } = await this.http.get('/logs', { params });
        const lines = (data.logs ?? []).map((l) => `${l.timestamp} ${stripAnsi(l.message)}`);
        return lines.reverse().join('\n');
    }
    async listOwners() {
        const { data } = await this.http.get('/owners');
        return data.map((row) => row.owner);
    }
}
exports.RenderClient = RenderClient;
function stripAnsi(s) {
    return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}
