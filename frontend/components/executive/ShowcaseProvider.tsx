'use client'

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type ShowcaseCtx = {
  on: boolean
  toggle: () => void
  setOn: (v: boolean) => void
}

const Ctx = createContext<ShowcaseCtx>({ on: false, toggle: () => {}, setOn: () => {} })

export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const sp = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const initial = sp?.get('showcase') === '1'
  const [on, setOn] = useState(initial)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.showcase = on ? 'on' : 'off'
    }
  }, [on])

  useEffect(() => {
    const qs = new URLSearchParams(Array.from(sp?.entries() ?? []))
    if (on) qs.set('showcase', '1')
    else qs.delete('showcase')
    const next = qs.toString()
    const url = next ? `${pathname}?${next}` : pathname
    router.replace(url, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on])

  const value = useMemo<ShowcaseCtx>(() => ({
    on,
    setOn,
    toggle: () => setOn(v => !v),
  }), [on])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShowcase() {
  return useContext(Ctx)
}
