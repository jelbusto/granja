-- Renombrar valor 'imagen' → 'foto' en tipo_archivo

-- 1. Actualizar registros existentes
UPDATE documentos SET tipo_archivo = 'foto' WHERE tipo_archivo = 'imagen';

-- 2. Actualizar el CHECK constraint
ALTER TABLE documentos DROP CONSTRAINT documentos_tipo_archivo_check;
ALTER TABLE documentos ADD CONSTRAINT documentos_tipo_archivo_check
  CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint', 'foto'));
