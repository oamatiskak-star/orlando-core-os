'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Suspense } from 'react'

function BankCallbackInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code  = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setMessage(`Tink autorisatie geweigerd: ${error}`)
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('Geen autorisatiecode ontvangen van Tink.')
      return
    }

    fetch('/api/bank/connect', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'complete_auth', code }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setStatus('ok')
          setMessage('ING-rekening succesvol verbonden!')
          setTimeout(() => router.push('/dashboard/dyme'), 2000)
        } else {
          setStatus('error')
          setMessage(json.error ?? 'Verbinding mislukt')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Netwerkfout bij verwerken autorisatie')
      })
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f]">
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4">
        {status === 'loading' && (
          <>
            <RefreshCw size={32} className="mx-auto text-indigo-400 animate-spin" />
            <p className="text-sm text-white">ING koppeling verwerken…</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <CheckCircle size={32} className="mx-auto text-green-400" />
            <p className="text-sm font-medium text-white">{message}</p>
            <p className="text-xs text-white/50">Je wordt doorgestuurd naar Dyme OS…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle size={32} className="mx-auto text-red-400" />
            <p className="text-sm font-medium text-white">Verbinding mislukt</p>
            <p className="text-xs text-white/55">{message}</p>
            <button onClick={() => router.push('/dashboard/dyme')}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Terug naar Dyme OS
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function BankCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0d0d0f]"><RefreshCw size={24} className="text-indigo-400 animate-spin" /></div>}>
      <BankCallbackInner />
    </Suspense>
  )
}
