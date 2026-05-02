-- Renombrar valor 'imagen' → 'foto' en tipo_archivo

-- 1. Soltar el constraint primero (IF EXISTS por si tiene nombre distinto)
ALTER TABLE documentos DROP CONSTRAINT IF EXISTS documentos_tipo_archivo_check;

-- 2. Actualizar cualquier valor que no sea de los permitidos
UPDATE documentos
SET tipo_archivo = 'foto'
WHERE tipo_archivo NOT IN ('pdf', 'word', 'powerpoint', 'foto');

-- 3. Añadir el constraint actualizado
ALTER TABLE documentos ADD CONSTRAINT documentos_tipo_archivo_check
  CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint', 'foto'));
