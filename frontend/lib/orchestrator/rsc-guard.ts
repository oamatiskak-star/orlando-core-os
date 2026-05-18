// RSC fetch guard.
//
// Next.js stuurt een fetch-request met header `rsc: 1` of query `?_rsc=...`
// wanneer een <Link> wordt geprefetcht of een Server Component een API-route
// "soft-navigates". Voor API-routes die een externe redirect doen (bv. OAuth)
// of die enkel via expliciete user-actie aangeroepen mogen worden, willen we
// dergelijke fetches direct afsluiten — anders triggert de browser een
// cross-origin redirect-fetch die op CORS faalt.
//
// Gebruik:
//   const guard = guardRscFetch(request); if (guard) return guard

import { NextRequest, NextResponse } from 'next/server'

export function guardRscFetch(request: NextRequest): NextResponse | null {
  const isRsc =
    request.headers.get('rsc') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1' ||
    request.nextUrl.searchParams.has('_rsc')

  if (!isRsc) return null

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}
