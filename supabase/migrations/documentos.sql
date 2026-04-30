-- Tabla de documentos y fotos asociados a granjas
CREATE TABLE IF NOT EXISTS documentos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL,
  tipo_archivo  TEXT        NOT NULL CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint', 'imagen')),
  categoria     TEXT        NOT NULL CHECK (categoria IN ('informe_tecnico', 'otros')),
  fecha_subida  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subido_por    TEXT        NOT NULL DEFAULT 'Javier Heras',
  tamano_bytes  BIGINT,
  url_archivo   TEXT,
  id_granja     UUID        REFERENCES granjas(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage: crear bucket "documentos" en Supabase Dashboard → Storage → New bucket
-- Marcar como Public para que los archivos tengan URL pública accesible
