-- Descripción corta en actividades (aparece en el calendario)
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Dirección del empleado (para cálculo de distancia)
ALTER TABLE usuarios_perfil ADD COLUMN IF NOT EXISTS direccion TEXT;
