-- ============================================================
-- FICHAJES
-- ============================================================
CREATE TABLE IF NOT EXISTS fichajes (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado         UUID           NOT NULL REFERENCES usuarios_perfil(id),
  fecha               DATE           NOT NULL,
  hora_entrada        TIMESTAMPTZ,
  hora_salida         TIMESTAMPTZ,
  minutos_trabajados  INTEGER        NOT NULL DEFAULT 0,
  es_manual           BOOLEAN        NOT NULL DEFAULT false,
  latitud_entrada     NUMERIC(10,7),
  longitud_entrada    NUMERIC(10,7),
  latitud_salida      NUMERIC(10,7),
  longitud_salida     NUMERIC(10,7),
  notas               TEXT,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE fichajes DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS fichajes_updated_at ON fichajes;
CREATE TRIGGER fichajes_updated_at
  BEFORE UPDATE ON fichajes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- APROBACIONES MENSUALES DE FICHAJES
-- ============================================================
CREATE TABLE IF NOT EXISTS aprobaciones_fichajes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado      UUID        NOT NULL REFERENCES usuarios_perfil(id),
  anio             INTEGER     NOT NULL,
  mes              INTEGER     NOT NULL CHECK (mes BETWEEN 1 AND 12),
  total_minutos    INTEGER     NOT NULL DEFAULT 0,
  estado           TEXT        NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','aprobado','rechazado')),
  id_aprobador     UUID        REFERENCES usuarios_perfil(id),
  fecha_aprobacion TIMESTAMPTZ,
  comentario       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_empleado, anio, mes)
);

ALTER TABLE aprobaciones_fichajes DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS aprobaciones_fichajes_updated_at ON aprobaciones_fichajes;
CREATE TRIGGER aprobaciones_fichajes_updated_at
  BEFORE UPDATE ON aprobaciones_fichajes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PERMISOS
-- ============================================================
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000001', 'empleados/fichajes', true,  true),
  ('00000000-0000-0000-0001-000000000002', 'empleados/fichajes', true,  true),
  ('00000000-0000-0000-0001-000000000003', 'empleados/fichajes', false, false)
ON CONFLICT (id_tipo_usuario, ruta) DO UPDATE
  SET puede_ver = EXCLUDED.puede_ver, puede_editar = EXCLUDED.puede_editar;
