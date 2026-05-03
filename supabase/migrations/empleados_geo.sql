-- Añade coordenadas geográficas a la tabla de perfiles de usuario/empleado
ALTER TABLE usuarios_perfil
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
