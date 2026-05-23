'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { CompanyProvider } from '@/lib/company-context'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <CompanyProvider>
      <div className="flex min-h-screen bg-[#121220] overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 md:hidden transition-opacity duration-200"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar title="Orlando Core OS" onMenuOpen={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-5">
            {children}
          </main>
        </div>
      </div>
    </CompanyProvider>
  )
}
