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

CREATE TABLE IF NOT EXISTS login_attempts (
  client_key TEXT PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_login_rate_limit(client_key_input TEXT)
RETURNS TABLE (allowed BOOLEAN, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row login_attempts%ROWTYPE;
  now_time TIMESTAMPTZ := now();
  window_seconds CONSTANT INT := 15 * 60;
BEGIN
  SELECT * INTO current_row
  FROM login_attempts
  WHERE client_key = client_key_input
  FOR UPDATE;

  IF NOT FOUND OR current_row.window_started_at + make_interval(secs => window_seconds) <= now_time THEN
    INSERT INTO login_attempts (client_key, attempt_count, window_started_at)
    VALUES (client_key_input, 1, now_time)
    ON CONFLICT (client_key) DO UPDATE
      SET attempt_count = 1, window_started_at = now_time;
    RETURN QUERY SELECT TRUE, 0;
  ELSIF current_row.attempt_count >= 5 THEN
    RETURN QUERY SELECT FALSE,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (current_row.window_started_at + make_interval(secs => window_seconds) - now_time)))::INT);
  ELSE
    UPDATE login_attempts
    SET attempt_count = attempt_count + 1
    WHERE client_key = client_key_input;
    RETURN QUERY SELECT TRUE, 0;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION clear_login_rate_limit(client_key_input TEXT)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM login_attempts WHERE client_key = client_key_input;
$$;

REVOKE ALL ON FUNCTION check_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION clear_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;

-- Enable RLS
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read letters" ON letters;

-- Las lecturas y escrituras pasan por Edge Functions con autorización JWT.
-- No se crean políticas para anon/authenticated: RLS bloquea el acceso directo.

DROP FUNCTION IF EXISTS update_letter_with_history(UUID, TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS letter_history;
