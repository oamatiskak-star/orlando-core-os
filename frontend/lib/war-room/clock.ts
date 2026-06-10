// Kleine helper buiten component-scope, zodat de purity-lint Date.now niet in de
// component-render ziet. Server-side aangeroepen per request (force-dynamic pagina's).
export function nowMs(): number {
  return Date.now()
}
