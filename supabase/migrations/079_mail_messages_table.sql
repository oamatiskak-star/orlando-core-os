-- Create mail_messages table for email tracking
CREATE TABLE IF NOT EXISTS public.mail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  response_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mail_account_id UUID REFERENCES public.mail_accounts(id) ON DELETE SET NULL
);

-- Create indexes for faster queries
CREATE INDEX idx_mail_messages_company_id ON public.mail_messages(company_id);
CREATE INDEX idx_mail_messages_created_at ON public.mail_messages(created_at);
CREATE INDEX idx_mail_messages_company_created ON public.mail_messages(company_id, created_at);
CREATE INDEX idx_mail_messages_read_at ON public.mail_messages(read_at);

-- Enable RLS
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "mail_messages_read" ON public.mail_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.company_id = mail_messages.company_id
    )
  );

CREATE POLICY "mail_messages_insert" ON public.mail_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.company_id = mail_messages.company_id
    )
  );

CREATE POLICY "mail_messages_update" ON public.mail_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.company_id = mail_messages.company_id
    )
  );
