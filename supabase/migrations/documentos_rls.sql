-- ── Tabla documentos ──────────────────────────────────────────────────────────

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso público a documentos"
  ON documentos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── Storage bucket "documentos" ───────────────────────────────────────────────

CREATE POLICY "Acceso público a archivos"
  ON storage.objects FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');
