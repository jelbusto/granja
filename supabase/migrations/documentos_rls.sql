-- ── 1. Crear el bucket si no existe ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── 2. Tabla documentos: acceso total sin autenticación ───────────────────────
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso público a documentos" ON documentos;
CREATE POLICY "Acceso público a documentos"
  ON documentos FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 3. Storage: acceso total al bucket documentos ─────────────────────────────
DROP POLICY IF EXISTS "Acceso público a archivos" ON storage.objects;
CREATE POLICY "Acceso público a archivos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');
