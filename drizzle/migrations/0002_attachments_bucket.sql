-- Bucket privado para adjuntos (las políticas de storage.objects ya existen en 0000)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', false, 20971520)
ON CONFLICT (id) DO NOTHING;
