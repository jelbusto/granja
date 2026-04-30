-- ── 1. Crear / asegurar bucket público ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── 2. Limpiar policies anteriores en storage.objects ─────────────────────────
DROP POLICY IF EXISTS "Acceso público a archivos"                        ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir archivos"      ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer archivos"       ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar archivos"   ON storage.objects;
DROP POLICY IF EXISTS "documentos_public_access"                         ON storage.objects;

-- ── 3. Policy storage: TO public (aplica a todos, incluido anon) ──────────────
CREATE POLICY "documentos_public_access"
  ON storage.objects FOR ALL
  TO public
  USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');

-- ── 4. Limpiar policies anteriores en tabla documentos ────────────────────────
DROP POLICY IF EXISTS "Acceso público a documentos" ON documentos;
DROP POLICY IF EXISTS "documentos_public"           ON documentos;

-- ── 5. Policy tabla: TO public ────────────────────────────────────────────────
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_public"
  ON documentos FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
