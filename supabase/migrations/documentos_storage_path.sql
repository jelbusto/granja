-- Renombrar url_archivo → storage_path
-- (ahora se guarda la ruta relativa dentro del bucket, no la URL pública)
ALTER TABLE documentos RENAME COLUMN url_archivo TO storage_path;
