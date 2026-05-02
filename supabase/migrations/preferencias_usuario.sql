-- Preferencias por usuario (tema de color e idioma)
ALTER TABLE usuarios_perfil
  ADD COLUMN IF NOT EXISTS tema   TEXT DEFAULT 'azul',
  ADD COLUMN IF NOT EXISTS idioma TEXT DEFAULT 'es';
