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

DROP POLICY IF EXISTS "Public read letters" ON letters;
DROP POLICY IF EXISTS "Public read history" ON letter_history;

-- Las lecturas y escrituras pasan por Edge Functions con autorización JWT.
-- No se crean políticas para anon/authenticated: RLS bloquea el acceso directo.
