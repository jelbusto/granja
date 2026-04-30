-- ── Tabla documentos ──────────────────────────────────────────────────────────

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver documentos"
  ON documentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden subir documentos"
  ON documentos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar documentos"
  ON documentos FOR DELETE
  TO authenticated
  USING (true);

-- ── Storage bucket "documentos" ───────────────────────────────────────────────

CREATE POLICY "Usuarios autenticados pueden subir archivos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Usuarios autenticados pueden leer archivos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "Usuarios autenticados pueden eliminar archivos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documentos');
