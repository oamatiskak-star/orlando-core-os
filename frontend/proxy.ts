import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const MOCK_PATTERNS = ['/api/mock', '/api/demo', '/api/fake', '/api/test-data', '__mock__', '__demo__']

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // MockGuard — blokkeert mock endpoints in productie
  if (process.env.PRODUCTION_STRICT_MODE === 'true' && pathname.startsWith('/api')) {
    const lower = pathname.toLowerCase()
    if (MOCK_PATTERNS.some(p => lower.includes(p))) {
      return NextResponse.json({ error: 'MockGuard: mock endpoints geblokkeerd', code: 'MOCK_BLOCKED' }, { status: 403 })
    }
  }

  // Domain routing: maildash.strkbeheer.nl → altijd /dashboard/mail
  // Vangt zowel root als post-login /dashboard redirect op
  const isMailDash = hostname === 'maildash.strkbeheer.nl' || hostname.startsWith('maildash.')
  if (isMailDash && (pathname === '/' || pathname === '/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/mail'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Beschermde routes — redirect naar /login als niet ingelogd
  if (!user && pathname.startsWith('/dashboard')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Al ingelogd en naar /login — redirect naar mobile of dashboard
  if (user && pathname === '/login') {
    const ua = request.headers.get('user-agent') ?? ''
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
    const target = request.nextUrl.clone()
    target.pathname = isMobile ? '/mobile' : '/dashboard'
    return NextResponse.redirect(target)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
