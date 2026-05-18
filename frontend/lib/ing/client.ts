import { createHash, createSign } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'

const BASE_URL   = process.env.ING_BASE_URL   ?? 'https://api.sandbox.ing.com'
const CLIENT_ID  = process.env.ING_CLIENT_ID  ?? 'e77d776b-90af-4684-bebc-521e5b2614dd'

function loadFile(envVar: string, fallback: string): string {
  const p = process.env[envVar] ?? fallback
  return readFileSync(join(process.cwd(), p), 'utf-8')
}

function getSignKey()  { return loadFile('ING_SIGN_KEY_PATH',  './ing-connect/ing-open-banking-cli/apps/sandbox/certificates/example_client_signing.key') }
function getSignCert() { return loadFile('ING_SIGN_CERT_PATH', './ing-connect/ing-open-banking-cli/apps/sandbox/certificates/example_client_signing.pem') }
function getTlsCert()  { return loadFile('ING_TLS_CERT_PATH',  './ing-connect/ing-open-banking-cli/apps/sandbox/certificates/example_client_tls.pem') }
function getTlsKey()   { return loadFile('ING_TLS_KEY_PATH',   './ing-connect/ing-open-banking-cli/apps/sandbox/certificates/example_client_tls.key') }

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function certFingerprint(pem: string): string {
  const der = Buffer.from(
    pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''),
    'base64',
  )
  return base64url(createHash('sha256').update(der).digest())
}

function buildJwsSignature(
  method: string,
  path: string,
  body: string,
  contentType: string,
): { jwsSignature: string; digest: string } {
  const signCert = getSignCert()
  const signKey  = getSignKey()

  const fingerprint = certFingerprint(signCert)
  const sigT        = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  const header = JSON.stringify({
    b64: false,
    'x5t#S256': fingerprint,
    crit: ['sigT', 'sigD', 'b64'],
    sigT,
    sigD: { pars: ['(request-target)', 'digest', 'content-type'], mId: 'http://uri.etsi.org/19182/HttpHeaders' },
    alg: 'PS256',
  })

  const headerB64 = base64url(Buffer.from(header))
  const digest    = 'SHA-256=' + createHash('sha256').update(body).digest('base64')

  const signingString = `(request-target): ${method.toLowerCase()} ${path}\ndigest: ${digest}\ncontent-type: ${contentType}`
  const input         = `${headerB64}.${signingString}`

  const signer = createSign('RSA-SHA256')
  signer.update(input)
  const sigValue = base64url(signer.sign({ key: signKey, padding: 1, saltLength: 32 })) // RSA-PSS padding=1

  return { jwsSignature: `${headerB64}..${sigValue}`, digest }
}

// Application token (client credentials)
export async function getApplicationToken(): Promise<string> {
  const path        = '/oauth2/token'
  const body        = 'grant_type=client_credentials'
  const contentType = 'application/x-www-form-urlencoded'
  const { jwsSignature, digest } = buildJwsSignature('POST', path, body, contentType)

  const signCert = getSignCert().replace(/\n/g, '')
  const tlsCert  = getTlsCert()
  const tlsKey   = getTlsKey()

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Digest': digest,
      'x-jws-signature': jwsSignature,
      'TPP-Signature-Certificate': signCert,
      'Authorization': `Bearer ${CLIENT_ID}`,
    },
    body,
    // @ts-ignore — Node.js fetch cert options
    agent: { cert: tlsCert, key: tlsKey, rejectUnauthorized: false },
  })

  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(`ING token error: ${JSON.stringify(data)}`)
  return data.access_token
}

// OAuth2 authorization URL for account linking
export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    scope:         'accounts:view',
    redirect_uri:  redirectUri,
    response_type: 'code',
    state,
  })
  return `${BASE_URL}/oauth2/authorization-server-url?${params}`
}

// Exchange auth code for customer token
export async function getCustomerToken(code: string, redirectUri: string): Promise<{ access_token: string; refresh_token?: string }> {
  const path        = '/oauth2/token'
  const body        = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`
  const contentType = 'application/x-www-form-urlencoded'
  const { jwsSignature, digest } = buildJwsSignature('POST', path, body, contentType)

  const appToken = await getApplicationToken()
  const signCert = getSignCert().replace(/\n/g, '')
  const tlsCert  = getTlsCert()
  const tlsKey   = getTlsKey()

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Digest': digest,
      'x-jws-signature': jwsSignature,
      'TPP-Signature-Certificate': signCert,
      'Authorization': `Bearer ${appToken}`,
    },
    body,
    // @ts-ignore
    agent: { cert: tlsCert, key: tlsKey, rejectUnauthorized: false },
  })

  return res.json()
}

// Get accounts for a customer
export async function getAccounts(customerToken: string): Promise<unknown[]> {
  const tlsCert = getTlsCert()
  const tlsKey  = getTlsKey()

  const res = await fetch(`${BASE_URL}/v3/accounts`, {
    headers: { 'Authorization': `Bearer ${customerToken}` },
    // @ts-ignore
    agent: { cert: tlsCert, key: tlsKey, rejectUnauthorized: false },
  })

  const data = await res.json() as { accounts?: unknown[] }
  return data.accounts ?? []
}

// Get transactions for an account
export async function getTransactions(
  customerToken: string,
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<unknown[]> {
  const tlsCert = getTlsCert()
  const tlsKey  = getTlsKey()

  const params = new URLSearchParams()
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo)   params.set('dateTo', dateTo)
  params.set('limit', '200')

  const res = await fetch(`${BASE_URL}/v3/accounts/${accountId}/transactions?${params}`, {
    headers: { 'Authorization': `Bearer ${customerToken}` },
    // @ts-ignore
    agent: { cert: tlsCert, key: tlsKey, rejectUnauthorized: false },
  })

  const data = await res.json() as { transactions?: unknown[] }
  return data.transactions ?? []
}
