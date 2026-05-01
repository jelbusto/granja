-- ============================================================
-- SEGURIDAD: Roles, permisos de menú y perfiles de usuario
-- ============================================================

-- ------------------------------------------------------------
-- 1. TIPOS DE USUARIO (roles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_usuario (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL UNIQUE,
  descripcion   TEXT,
  es_trabajador BOOLEAN     NOT NULL DEFAULT false,
  activo        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tipos_usuario DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. PERMISOS POR MENÚ Y ROL
--    ruta: clave del menú tal como aparece en el sidebar
--    Ejemplos: 'dashboard', 'produccion', 'mantenimientos',
--              'mantenimientos/granjas', 'mantenimientos/tipos_usuario'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permisos_menu (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tipo_usuario UUID        NOT NULL REFERENCES tipos_usuario(id) ON DELETE CASCADE,
  ruta            TEXT        NOT NULL,
  puede_ver       BOOLEAN     NOT NULL DEFAULT false,
  puede_editar    BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_tipo_usuario, ruta)
);

ALTER TABLE permisos_menu DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. PERFIL DE USUARIO (extiende auth.users de Supabase)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios_perfil (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT        NOT NULL,
  apellidos       TEXT,
  email           TEXT,
  telefono        TEXT,
  n_colegiado     TEXT,                          -- para veterinarios
  id_tipo_usuario UUID        REFERENCES tipos_usuario(id),
  id_granja       UUID        REFERENCES granjas(id),  -- solo para clientes
  activo          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE usuarios_perfil DISABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usuarios_perfil_updated_at ON usuarios_perfil;
CREATE TRIGGER usuarios_perfil_updated_at
  BEFORE UPDATE ON usuarios_perfil
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SEED: Tipos de usuario básicos
-- ============================================================
INSERT INTO tipos_usuario (id, nombre, descripcion, es_trabajador) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Admin',
   'Acceso total a todas las funcionalidades y configuración del sistema', true),
  ('00000000-0000-0000-0001-000000000002', 'Veterinario',
   'Trabajador con acceso operativo completo. Sin gestión de usuarios', true),
  ('00000000-0000-0000-0001-000000000003', 'Cliente',
   'Acceso de solo lectura a los datos de su propia granja y datos agregados del sector', false)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- SEED: Permisos de menú
--
-- Rutas existentes en el sidebar:
--   dashboard                        Visión general
--   produccion                       Datos de producción
--   economico                        Datos económicos
--   carga_datos                      Carga de datos
--   documentacion                    Documentación
--   mantenimientos                   Grupo mantenimientos
--   mantenimientos/granjas           Granjas
--   mantenimientos/tipos_usuario     Tipos de usuario   (nuevo)
--   mantenimientos/usuarios          Usuarios           (nuevo)
--   configuracion                    Configuración
-- ============================================================

-- ADMIN — acceso total
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000001', 'dashboard',                      true,  true),
  ('00000000-0000-0000-0001-000000000001', 'produccion',                     true,  true),
  ('00000000-0000-0000-0001-000000000001', 'economico',                      true,  true),
  ('00000000-0000-0000-0001-000000000001', 'carga_datos',                    true,  true),
  ('00000000-0000-0000-0001-000000000001', 'documentacion',                  true,  true),
  ('00000000-0000-0000-0001-000000000001', 'mantenimientos',                 true,  true),
  ('00000000-0000-0000-0001-000000000001', 'mantenimientos/granjas',         true,  true),
  ('00000000-0000-0000-0001-000000000001', 'mantenimientos/tipos_usuario',   true,  true),
  ('00000000-0000-0000-0001-000000000001', 'mantenimientos/usuarios',        true,  true),
  ('00000000-0000-0000-0001-000000000001', 'configuracion',                  true,  true)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;

-- VETERINARIO — operativo completo, sin gestión de usuarios ni tipos
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000002', 'dashboard',                      true,  true),
  ('00000000-0000-0000-0001-000000000002', 'produccion',                     true,  true),
  ('00000000-0000-0000-0001-000000000002', 'economico',                      true,  true),
  ('00000000-0000-0000-0001-000000000002', 'carga_datos',                    true,  true),
  ('00000000-0000-0000-0001-000000000002', 'documentacion',                  true,  true),
  ('00000000-0000-0000-0001-000000000002', 'mantenimientos',                 true,  false),
  ('00000000-0000-0000-0001-000000000002', 'mantenimientos/granjas',         true,  true),
  ('00000000-0000-0000-0001-000000000002', 'mantenimientos/tipos_usuario',   false, false),
  ('00000000-0000-0000-0001-000000000002', 'mantenimientos/usuarios',        false, false),
  ('00000000-0000-0000-0001-000000000002', 'configuracion',                  true,  true)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;

-- CLIENTE — solo lectura de su granja y datos agregados del sector
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000003', 'dashboard',                      true,  false),
  ('00000000-0000-0000-0001-000000000003', 'produccion',                     true,  false),
  ('00000000-0000-0000-0001-000000000003', 'economico',                      true,  false),
  ('00000000-0000-0000-0001-000000000003', 'carga_datos',                    false, false),
  ('00000000-0000-0000-0001-000000000003', 'documentacion',                  true,  false),
  ('00000000-0000-0000-0001-000000000003', 'mantenimientos',                 false, false),
  ('00000000-0000-0000-0001-000000000003', 'mantenimientos/granjas',         false, false),
  ('00000000-0000-0000-0001-000000000003', 'mantenimientos/tipos_usuario',   false, false),
  ('00000000-0000-0000-0001-000000000003', 'mantenimientos/usuarios',        false, false),
  ('00000000-0000-0000-0001-000000000003', 'configuracion',                  false, false)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;
