import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export type MailAccount = {
  id: string
  user_id: string
  provider: 'gmail' | 'imap'
  email: string
  display_name: string | null
  gmail_access_token: string | null
  gmail_refresh_token: string | null
  gmail_token_expiry: string | null
  imap_host: string | null
  imap_port: number | null
  imap_user: string | null
  imap_pass_encrypted: string | null
  last_sync_at: string | null
  sync_status: 'idle' | 'syncing' | 'error'
  created_at: string
}

export type MailMessage = {
  id: string
  account_id: string
  gmail_message_id: string | null
  gmail_thread_id: string | null
  subject: string | null
  from_email: string | null
  from_name: string | null
  to_emails: string[]
  cc_emails: string[]
  body_text: string | null
  body_html: string | null
  received_at: string | null
  is_read: boolean
  is_starred: boolean
  is_archived: boolean
  company: string | null
  category: string | null
  priority: string
  ai_summary: string | null
  ai_action_suggestion: string | null
  ai_confidence: number
  spam_score: number
  threat_detected: boolean
  threat_reason: string | null
  moneybird_status: string
  moneybird_document_id: string | null
  processed_at: string | null
  created_at: string
}

export type MailContact = {
  id: string
  email: string
  name: string | null
  company: string | null
  contact_type: string | null
  priority: string
  total_interactions: number
  last_interaction_at: string | null
  payment_status: string | null
  open_actions: number
  sentiment: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MailDraft = {
  id: string
  message_id: string | null
  to_email: string | null
  subject: string | null
  body: string | null
  attachments: unknown[]
  status: string
  ai_reasoning: string | null
  ai_confidence: number
  version: number
  approved_at: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type MailAttachment = {
  id: string
  message_id: string
  filename: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_path: string | null
  document_type: string | null
  ai_extracted_data: Record<string, unknown>
  created_at: string
}
