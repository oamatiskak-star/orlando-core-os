export interface HttpClientConfig {
    timeout?: number;
    retries?: number;
    userAgent?: string;
}
export declare class HttpClient {
    private timeout;
    private retries;
    private userAgent;
    constructor(config?: HttpClientConfig);
    get<T>(url: string, attempt?: number): Promise<T | null>;
    post<T>(url: string, body: Record<string, unknown>, attempt?: number): Promise<T | null>;
}
//# sourceMappingURL=http-client.d.ts.map