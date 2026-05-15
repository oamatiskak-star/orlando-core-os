-- Migration 020: Voeg UNIQUE constraint toe op mail_accounts.email
-- Vereist voor upsert onConflict: 'email' in OAuth callback

ALTER TABLE public.mail_accounts
  ADD CONSTRAINT mail_accounts_email_unique UNIQUE (email);
