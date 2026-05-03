-- Tabla de tareas/notas pendientes
CREATE TABLE IF NOT EXISTS tareas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  descripcion TEXT        NOT NULL,
  estado      TEXT        NOT NULL DEFAULT 'pendiente'
                          CHECK (estado IN ('pendiente', 'resuelta')),
  id_granja   UUID        REFERENCES granjas(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: todos los usuarios autenticados pueden ver y gestionar tareas
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tareas_select" ON tareas FOR SELECT TO authenticated USING (true);
CREATE POLICY "tareas_insert" ON tareas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tareas_update" ON tareas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tareas_delete" ON tareas FOR DELETE TO authenticated USING (true);
