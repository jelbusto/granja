-- ============================================================
-- ACTIVIDADES: Calendario de visitas y reuniones
-- ============================================================

-- Add color column to usuarios_perfil
ALTER TABLE usuarios_perfil ADD COLUMN IF NOT EXISTS color TEXT;

-- Add id_aprobador to usuarios_perfil if missing (may already exist)
ALTER TABLE usuarios_perfil ADD COLUMN IF NOT EXISTS id_aprobador UUID REFERENCES usuarios_perfil(id);

-- ------------------------------------------------------------
-- 1. TIPOS DE ACTIVIDAD
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_actividad (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL UNIQUE,
  activo     BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tipos_actividad DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS tipos_actividad_updated_at ON tipos_actividad;
CREATE TRIGGER tipos_actividad_updated_at
  BEFORE UPDATE ON tipos_actividad
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed
INSERT INTO tipos_actividad (nombre) VALUES
  ('Visita repro'),
  ('Visita calidad'),
  ('Reunión'),
  ('Urgencia')
ON CONFLICT (nombre) DO NOTHING;

-- ------------------------------------------------------------
-- 2. ACTIVIDADES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha        DATE        NOT NULL,
  hora_inicio  TIME,
  hora_fin     TIME,
  id_tipo      UUID        REFERENCES tipos_actividad(id),
  id_granja    UUID        REFERENCES granjas(id),
  comentarios  TEXT,
  created_by   UUID        REFERENCES usuarios_perfil(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE actividades DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS actividades_updated_at ON actividades;
CREATE TRIGGER actividades_updated_at
  BEFORE UPDATE ON actividades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 3. ACTIVIDADES_EMPLEADOS (junction)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividades_empleados (
  id_actividad UUID NOT NULL REFERENCES actividades(id) ON DELETE CASCADE,
  id_empleado  UUID NOT NULL REFERENCES usuarios_perfil(id) ON DELETE CASCADE,
  PRIMARY KEY (id_actividad, id_empleado)
);

ALTER TABLE actividades_empleados DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PERMISOS DE MENÚ para actividades
-- ============================================================

-- ADMIN — actividades + tipos_actividad (can_see + can_edit)
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000001', 'actividades',                    true,  true),
  ('00000000-0000-0000-0001-000000000001', 'mantenimientos/tipos_actividad', true,  true)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;

-- VETERINARIO — actividades (can_see + can_edit), tipos_actividad (can_see only)
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000002', 'actividades',                    true,  true),
  ('00000000-0000-0000-0001-000000000002', 'mantenimientos/tipos_actividad', true,  false)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;

-- CLIENTE — no access
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000003', 'actividades',                    false, false),
  ('00000000-0000-0000-0001-000000000003', 'mantenimientos/tipos_actividad', false, false)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;
