import type { Metadata, Viewport } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MobileNav from '@/components/mobile/MobileNav'
import SWRegister from '@/components/mobile/SWRegister'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { template: '%s — OC OS', default: 'Orlando Core OS' },
  description: 'AI-gedreven vastgoed-, bouw- en mediaplatform',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'OC OS' },
}

export const viewport: Viewport = {
  themeColor: '#07070f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div
      className="flex flex-col bg-[#07070f] text-white"
      style={{ minHeight: '100dvh' }}
    >
      <SWRegister />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(3.75rem + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
