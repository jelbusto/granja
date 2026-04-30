-- Para pruebas: deshabilitar RLS completamente en la tabla documentos
-- (no requiere policies, cualquier conexión puede leer/escribir/borrar)
ALTER TABLE documentos DISABLE ROW LEVEL SECURITY;

-- Storage: bucket público con acceso total
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "documentos_public_access" ON storage.objects;
CREATE POLICY "documentos_public_access"
  ON storage.objects FOR ALL
  TO public
  USING (bucket_id = 'documentos')
  WITH CHECK (bucket_id = 'documentos');
