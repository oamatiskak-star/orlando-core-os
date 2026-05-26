// supabase.mjs — minimale PostgREST client via global fetch (geen SDK-dependency).
// Service-role key => bypass RLS. Ondersteunt schema-targeting via profile headers.
import { SUPABASE_URL, SERVICE_KEY } from './config.mjs'

const REST = `${SUPABASE_URL}/rest/v1`

function headers(schema, extra = {}) {
  const h = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
  if (schema) {
    h['Accept-Profile'] = schema
    h['Content-Profile'] = schema
  }
  return h
}

/** SELECT — params is een querystring zonder leidende '?'. */
export async function select(table, params, schema = 'public') {
  const res = await fetch(`${REST}/${table}?${params}`, { headers: headers(schema) })
  if (!res.ok) throw new Error(`select ${table} ${res.status}: ${await res.text()}`)
  return res.json()
}

/** INSERT — rows is een array; geeft de aangemaakte rijen terug. */
export async function insert(table, rows, schema = 'public') {
  const res = await fetch(`${REST}/${table}`, {
    method: 'POST',
    headers: headers(schema, { Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`insert ${table} ${res.status}: ${await res.text()}`)
  return res.json()
}

/** PATCH — update rijen die matchen op de filter-querystring. */
export async function update(table, filter, patch, schema = 'public') {
  const res = await fetch(`${REST}/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers(schema, { Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`update ${table} ${res.status}: ${await res.text()}`)
  return res.json()
}
