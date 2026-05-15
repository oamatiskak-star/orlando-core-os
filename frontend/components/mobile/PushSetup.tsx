'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2, CheckCircle } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return buffer
}

type PermState = 'loading' | 'unsupported' | 'denied' | 'granted' | 'default'

export default function PushSetup() {
  const [permState, setPermState] = useState<PermState>('loading')
  const [subscribed, setSubscribed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermState('unsupported')
      return
    }
    setPermState(Notification.permission as PermState)
    checkSubscription()
  }, [])

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {}
  }

  async function subscribe() {
    setWorking(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      setPermState(permission as PermState)
      if (permission !== 'granted') {
        setWorking(false)
        return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setError('VAPID sleutel niet geconfigureerd (NEXT_PUBLIC_VAPID_PUBLIC_KEY ontbreekt)')
        setWorking(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const body = sub.toJSON()
      const res = await fetch('/api/mobile/push-subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: body.keys?.p256dh ?? '',
          auth: body.keys?.auth ?? '',
          user_agent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Opslaan subscription mislukt')
      } else {
        setSubscribed(true)
      }
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Onbekende fout')
    } finally {
      setWorking(false)
    }
  }

  async function unsubscribe() {
    setWorking(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch('/api/mobile/push-subscription', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      setSubscribed(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setWorking(false)
    }
  }

  if (permState === 'loading') {
    return <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse" />
  }

  if (permState === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-white/40 text-sm">
        <BellOff size={16} />
        <span>Push notificaties niet ondersteund op dit apparaat</span>
      </div>
    )
  }

  if (permState === 'denied') {
    return (
      <div className="flex items-center gap-2 text-amber-400/80 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
        <BellOff size={16} />
        <span>Notificaties geblokkeerd — sta toe in Safari instellingen</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {subscribed ? (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-sm text-emerald-300">Push notificaties actief</span>
          </div>
          <button
            onClick={unsubscribe}
            disabled={working}
            className="text-xs text-white/40 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {working ? <Loader2 size={12} className="animate-spin" /> : 'Uitschakelen'}
          </button>
        </div>
      ) : (
        <button
          onClick={subscribe}
          disabled={working}
          className="flex items-center gap-2.5 w-full bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
        >
          {working ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
          Activeer push notificaties
        </button>
      )}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
