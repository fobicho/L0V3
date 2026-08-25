-- Schema for Cartas de Amor (Love Letters)
-- Run this in Supabase SQL Editor

CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE letter_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID REFERENCES letters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  version INT NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_history ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can read letters)
CREATE POLICY "Public read letters" ON letters
  FOR SELECT USING (true);

CREATE POLICY "Public read history" ON letter_history
  FOR SELECT USING (true);

-- Write access only via service_role (Edge Functions use service_role key)
-- The anon key CANNOT write — this is enforced by RLS with no INSERT/UPDATE/DELETE policies
