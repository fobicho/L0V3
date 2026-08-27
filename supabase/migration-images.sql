-- Migración: agregar imágenes a las cartas
-- Ejecutar en el SQL Editor de Supabase (solo una vez).

ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Bucket público para las imágenes de las cartas.
INSERT INTO storage.buckets (id, name, public)
VALUES ('letter-images', 'letter-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read letter images" ON storage.objects;
CREATE POLICY "Public read letter images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'letter-images');

DROP POLICY IF EXISTS "Service role manage letter images" ON storage.objects;
CREATE POLICY "Service role manage letter images" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'letter-images')
  WITH CHECK (bucket_id = 'letter-images');
