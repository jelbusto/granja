-- Tabla de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL,
  tipo_archivo  TEXT        NOT NULL CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint')),
  categoria     TEXT        NOT NULL CHECK (categoria IN ('informe_tecnico', 'otros')),
  fecha_subida  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subido_por    TEXT        NOT NULL DEFAULT 'Javier Heras',
  tamano_bytes  BIGINT,
  url_archivo   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bucket de Storage (ejecutar también en Supabase Dashboard → Storage → New bucket)
-- Nombre: documentos
-- Public: true (para poder acceder a los archivos por URL)
