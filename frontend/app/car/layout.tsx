import type { Metadata, Viewport } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Terminal — OC OS',
  appleWebApp: { capable: true, statusBarStyle: 'black', title: 'Terminal' },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 1,
}

export default async function CarLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div
      className="bg-black font-mono"
      style={{ height: '100dvh', width: '100dvw', overflow: 'hidden' }}
    >
      {children}
    </div>
  )
}
