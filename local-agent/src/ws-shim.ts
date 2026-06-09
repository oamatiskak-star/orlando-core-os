// ws-shim.ts — Node 20 mist een global WebSocket, waardoor @supabase/realtime-js
// bij createClient-CONSTRUCTIE gooit ("Node.js 20 detected without native
// WebSocket support"). CF2-workers gebruiken UITSLUITEND de REST-API (.from/.rpc)
// en NOOIT realtime/.subscribe. Een onschuldige stub stilt de constructie-check
// zonder een 'ws'-dependency; er wordt nooit daadwerkelijk verbonden.
//
// MOET als ALLEREERSTE import staan, vóór elke @supabase/supabase-js-import.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  ;(globalThis as any).WebSocket = class CF2NoopWebSocket {
    onopen: unknown = null; onclose: unknown = null; onerror: unknown = null; onmessage: unknown = null
    close(): void { /* no-op */ }
    send(): void { /* no-op */ }
    addEventListener(): void { /* no-op */ }
    removeEventListener(): void { /* no-op */ }
  }
}
export {}
