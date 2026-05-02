-- ============================================================
-- V2: empleados = usuarios_perfil (es_trabajador)
-- Elimina tabla empleados, gastos_viaje referencia usuarios_perfil
-- ============================================================

-- 1. Aprobador en usuarios_perfil (quién aprueba los gastos de cada trabajador)
ALTER TABLE usuarios_perfil
  ADD COLUMN IF NOT EXISTS id_aprobador UUID REFERENCES usuarios_perfil(id);

-- 2. Reconstruir gastos_viaje apuntando a usuarios_perfil
DROP TABLE IF EXISTS gastos_viaje;
DROP TABLE IF EXISTS empleados;

CREATE TABLE gastos_viaje (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado          UUID           NOT NULL REFERENCES usuarios_perfil(id),
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

-- 3. Storage bucket (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gastos-viaje', 'gastos-viaje', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "gastos_viaje_public_access" ON storage.objects;
CREATE POLICY "gastos_viaje_public_access"
  ON storage.objects FOR ALL TO public
  USING (bucket_id = 'gastos-viaje')
  WITH CHECK (bucket_id = 'gastos-viaje');

-- 4. Actualizar permisos: quitar rutas antiguas, añadir grupo empleados
DELETE FROM permisos_menu
  WHERE ruta IN ('mantenimientos/empleados', 'gastos_viaje');

INSERT INTO permisos_menu (id_tipo_usuario, ruta, puede_ver, puede_editar) VALUES
  ('00000000-0000-0000-0001-000000000001', 'empleados',               true,  true),
  ('00000000-0000-0000-0001-000000000001', 'empleados/gastos_viaje',  true,  true),
  ('00000000-0000-0000-0001-000000000002', 'empleados',               true,  true),
  ('00000000-0000-0000-0001-000000000002', 'empleados/gastos_viaje',  true,  true),
  ('00000000-0000-0000-0001-000000000003', 'empleados',               false, false),
  ('00000000-0000-0000-0001-000000000003', 'empleados/gastos_viaje',  false, false)
ON CONFLICT (id_tipo_usuario, ruta) DO UPDATE
  SET puede_ver = EXCLUDED.puede_ver, puede_editar = EXCLUDED.puede_editar;
