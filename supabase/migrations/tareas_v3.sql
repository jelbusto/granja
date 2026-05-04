-- Recrear tabla tareas limpia con todos los campos necesarios
DROP TABLE IF EXISTS tareas CASCADE;

CREATE TABLE tareas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  descripcion TEXT        NOT NULL,
  estado      TEXT        NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente', 'resuelta')),
  id_empleado UUID        REFERENCES usuarios_perfil(id) ON DELETE SET NULL,
  id_granja   UUID        REFERENCES granjas(id)         ON DELETE SET NULL,
  created_by  UUID        REFERENCES usuarios_perfil(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

-- Función auxiliar: admin = tiene algún permiso de edición en el sistema
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios_perfil up
    JOIN permisos_menu pm
      ON pm.id_tipo_usuario::text = up.id_tipo_usuario::text
    WHERE up.id = auth.uid()
    AND pm.puede_editar = true
  );
$$;

-- Políticas
CREATE POLICY "tareas_select" ON tareas
  FOR SELECT TO authenticated
  USING (id_empleado = auth.uid() OR created_by = auth.uid() OR is_admin_user());

CREATE POLICY "tareas_insert" ON tareas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "tareas_update" ON tareas
  FOR UPDATE TO authenticated
  USING (id_empleado = auth.uid() OR created_by = auth.uid() OR is_admin_user());

CREATE POLICY "tareas_delete" ON tareas
  FOR DELETE TO authenticated
  USING (id_empleado = auth.uid() OR created_by = auth.uid() OR is_admin_user());
