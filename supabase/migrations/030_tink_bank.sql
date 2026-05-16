-- 030: Tink (by Visa) PSD2 bank koppeling — token opslag + provider switch

-- Voeg token kolommen toe aan personal_bank_connections (voor Tink OAuth tokens)
ALTER TABLE public.personal_bank_connections
  ADD COLUMN IF NOT EXISTS access_token   text,
  ADD COLUMN IF NOT EXISTS refresh_token  text;

-- Verwijder GoCardless-specifieke kolommen als ze leeg zijn (soft migration)
-- gocardless_req_id en gocardless_account_id worden niet meer gebruikt door Tink
-- Kolommen blijven bestaan voor achterwaartse compatibiliteit maar worden niet meer gevuld

-- Update credentials provider constraint: accepteer ook 'tink'
-- (de tabel gebruikt al text, geen enum, dus geen wijziging nodig)

-- Zorg dat policy voor service_role ook de nieuwe kolommen kan schrijven
-- (al gedekt door bestaande "service_only_bank_conn" policy)

-- Index voor snelle token lookup per verbinding
CREATE INDEX IF NOT EXISTS personal_bank_conn_status_idx
  ON public.personal_bank_connections(status);
