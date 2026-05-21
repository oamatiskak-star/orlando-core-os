-- Create uploads table for storage tracking
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for faster queries
CREATE INDEX idx_uploads_company_id ON public.uploads(company_id);
CREATE INDEX idx_uploads_created_at ON public.uploads(created_at);
CREATE INDEX idx_uploads_company_created ON public.uploads(company_id, created_at);

-- Enable RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "uploads_read" ON public.uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.company_id = uploads.company_id
    )
  );

CREATE POLICY "uploads_insert" ON public.uploads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.company_id = uploads.company_id
    )
  );
