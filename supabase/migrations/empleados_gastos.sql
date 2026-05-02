-- ============================================================
-- EMPLEADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS empleados (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario   UUID        REFERENCES usuarios_perfil(id),  -- cuenta del sistema (opcional)
  nombre       TEXT        NOT NULL,
  apellidos    TEXT,
  email        TEXT,
  telefono     TEXT,
  departamento TEXT,
  id_aprobador UUID        REFERENCES usuarios_perfil(id),  -- debe ser usuario Admin
  activo       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE empleados DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS empleados_updated_at ON empleados;
CREATE TRIGGER empleados_updated_at
  BEFORE UPDATE ON empleados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- GASTOS DE VIAJE
-- ============================================================
CREATE TABLE IF NOT EXISTS gastos_viaje (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado          UUID           NOT NULL REFERENCES empleados(id),
  fecha                DATE           NOT NULL,
  tipo                 TEXT           NOT NULL CHECK (tipo IN ('comida','kilometros','billetes','hotel','otros')),
  descripcion          TEXT,
  lugar                TEXT,
  importe_total        NUMERIC(10,2)  NOT NULL,
  porcentaje_iva       NUMERIC(5,2)   NOT NULL DEFAULT 21,
  importe_sin_iva      NUMERIC(10,2),
  importe_iva          NUMERIC(10,2),
  foto_path            TEXT,
  estado               TEXT           NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','aprobado','rechazado')),
  id_aprobador         UUID           REFERENCES usuarios_perfil(id),
  fecha_aprobacion     TIMESTAMPTZ,
  comentario_rechazo   TEXT,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE gastos_viaje DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS gastos_viaje_updated_at ON gastos_viaje;
CREATE TRIGGER gastos_viaje_updated_at
  BEFORE UPDATE ON gastos_viaje
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Storage bucket para fotos de facturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('gastos-viaje', 'gastos-viaje', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "gastos_viaje_public_access" ON storage.objects;
CREATE POLICY "gastos_viaje_public_access"
  ON storage.objects FOR ALL TO public
  USING (bucket_id = 'gastos-viaje')
  WITH CHECK (bucket_id = 'gastos-viaje');

-- ============================================================
-- PERMISOS para las nuevas rutas
-- ============================================================
INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000001', 'gastos_viaje',               true,  true),
  ('00000000-0000-0000-0001-000000000001', 'mantenimientos/empleados',   true,  true),
  ('00000000-0000-0000-0001-000000000002', 'gastos_viaje',               true,  true),
  ('00000000-0000-0000-0001-000000000002', 'mantenimientos/empleados',   false, false),
  ('00000000-0000-0000-0001-000000000003', 'gastos_viaje',               false, false),
  ('00000000-0000-0000-0001-000000000003', 'mantenimientos/empleados',   false, false)
ON CONFLICT (id_tipo_usuario, ruta) DO NOTHING;
