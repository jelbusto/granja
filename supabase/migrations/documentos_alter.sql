-- Añadir columna de granja
ALTER TABLE documentos
  ADD COLUMN id_granja UUID REFERENCES granjas(id);

-- Actualizar CHECK de tipo_archivo para incluir 'imagen'
ALTER TABLE documentos
  DROP CONSTRAINT documentos_tipo_archivo_check;

ALTER TABLE documentos
  ADD CONSTRAINT documentos_tipo_archivo_check
  CHECK (tipo_archivo IN ('pdf', 'word', 'powerpoint', 'imagen'));
