// storage-commander.ts
// Consumeert de storage_commands queue (migratie 099) voor DEZE host en voert
// de veilige storage-actie uit. Spiegelt worker-commander: dashboard zet een
// command-rij, dit module acteert en schrijft het resultaat terug. Idempotent.

import { getClient } from './supabase-state'
import { executeStorageCommand, HOST_ID } from './storage-guard'
import { reportStorageStatus } from './storage-reporter'
import { sendTelegram } from './telegram'

interface CommandRow {
  id: string
  host_id: string
  command: string
  status: string
}

export interface StorageCommanderResult {
  acted: string[]
  errors: string[]
}

export async function reconcileStorageCommands(): Promise<StorageCommanderResult> {
  const result: StorageCommanderResult = { acted: [], errors: [] }
  const c = getClient()
  if (!c) return result

  // Pending commando's voor deze host (of host_id='all').
  const { data, error } = await c
    .from('storage_commands')
    .select('id, host_id, command, status')
    .eq('status', 'pending')
    .in('host_id', [HOST_ID, 'all'])
    .order('requested_at', { ascending: true })
  if (error) {
    result.errors.push(error.message)
    return result
  }
  const commands = (data ?? []) as CommandRow[]
  if (commands.length === 0) return result

  for (const cmd of commands) {
    // Claim: pending → running (voorkomt dubbele uitvoering).
    const { data: claimed, error: claimErr } = await c
      .from('storage_commands')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', cmd.id)
      .eq('status', 'pending')
      .select('id')
    if (claimErr || !claimed || claimed.length === 0) continue // iemand anders claimde het al

    try {
      const res = await executeStorageCommand(cmd.command)
      await c
        .from('storage_commands')
        .update({ status: 'done', finished_at: new Date().toISOString(), result: res })
        .eq('id', cmd.id)
      result.acted.push(`${cmd.command}:${res}`)
      await sendTelegram('info', `🧹 Storage-command uitgevoerd op ${HOST_ID}`, `${cmd.command}\n${res}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await c
        .from('storage_commands')
        .update({ status: 'error', finished_at: new Date().toISOString(), result: `FOUT: ${msg.slice(0, 300)}` })
        .eq('id', cmd.id)
      result.errors.push(`${cmd.command}: ${msg}`)
      await sendTelegram('error', `🔴 Storage-command mislukt op ${HOST_ID}`, `${cmd.command}\n${msg.slice(0, 500)}`)
    }
    // Status direct verversen zodat het dashboard het effect ziet.
    await reportStorageStatus()
  }
  return result
}
