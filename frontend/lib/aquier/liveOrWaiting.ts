// lib/aquier/liveOrWaiting.ts
// Dwingt de NO-MOCK regel af op UI-niveau voor de USA Domination Engine.
// Als er geen live data is, tonen we expliciet "waiting for live source"
// in plaats van een verzonnen/placeholder waarde.

export const WAITING_LABEL = 'waiting for live source'

/** True als een sectie/connector nog geen echte data heeft. */
export function isWaiting(objectsOrRows: number | unknown[] | null | undefined): boolean {
  if (objectsOrRows == null) return true
  if (Array.isArray(objectsOrRows)) return objectsOrRows.length === 0
  return objectsOrRows <= 0
}

/** Geeft de echte count als string, of het waiting-label bij 0/geen data. */
export function liveCountOrWaiting(n: number | null | undefined): string {
  return isWaiting(n) ? WAITING_LABEL : String(n)
}

/** Geeft de waarde terug, of null als er gewacht moet worden (laat UI 'waiting' tonen). */
export function liveOrNull<T>(value: T, hasLiveData: boolean): T | null {
  return hasLiveData ? value : null
}
