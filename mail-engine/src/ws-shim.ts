// Node 20 mist native WebSocket; stub stilt de @supabase/realtime-js constructie-check.
// Mail-engine gebruikt uitsluitend REST (.from/.rpc), nooit realtime/.subscribe.
// MOET als allereerste import staan, vóór @supabase/supabase-js.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  ;(globalThis as any).WebSocket = class NoopWebSocket {
    onopen: unknown = null; onclose: unknown = null; onerror: unknown = null; onmessage: unknown = null
    close(): void { /* no-op */ }
    send(): void { /* no-op */ }
    addEventListener(): void { /* no-op */ }
    removeEventListener(): void { /* no-op */ }
  }
}
export {}
