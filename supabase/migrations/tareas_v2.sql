-- Añadir campos id_empleado y created_by a tareas
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS id_empleado UUID REFERENCES usuarios_perfil(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES usuarios_perfil(id) ON DELETE SET NULL;

-- Función auxiliar: el usuario actual tiene algún permiso de edición → es admin
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

-- Reemplazar políticas anteriores
DROP POLICY IF EXISTS "auth_select" ON tareas;
DROP POLICY IF EXISTS "auth_insert" ON tareas;
DROP POLICY IF EXISTS "auth_update" ON tareas;
DROP POLICY IF EXISTS "auth_delete" ON tareas;

-- SELECT: propia (asignada o creada por mí) ó admin
CREATE POLICY "tareas_select" ON tareas
  FOR SELECT TO authenticated
  USING (
    id_empleado = auth.uid()
    OR created_by  = auth.uid()
    OR is_admin_user()
  );

-- INSERT: cualquier usuario autenticado puede asignar tareas
CREATE POLICY "tareas_insert" ON tareas
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE / DELETE: propias o admin
CREATE POLICY "tareas_update" ON tareas
  FOR UPDATE TO authenticated
  USING (id_empleado = auth.uid() OR created_by = auth.uid() OR is_admin_user());

CREATE POLICY "tareas_delete" ON tareas
  FOR DELETE TO authenticated
  USING (id_empleado = auth.uid() OR created_by = auth.uid() OR is_admin_user());
