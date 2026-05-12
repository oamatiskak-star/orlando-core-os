'use client'

import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function OAuthBanner() {
  const params = useSearchParams()
  const success = params.get('oauth_success')
  const error   = params.get('oauth_error')

  if (!success && !error) return null

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium ${
      success
        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
        : 'bg-red-500/10 border border-red-500/20 text-red-400'
    }`}>
      {success
        ? <><CheckCircle size={14} /> Kanaal succesvol verbonden via OAuth</>
        : <><AlertCircle size={14} /> OAuth fout: {error}</>
      }
    </div>
  )
}
