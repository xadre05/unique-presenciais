-- Agente Editor de Vídeo (21/10/2026): o vídeo editado é montado no navegador; o Chrome grava em MP4, mas outros
-- navegadores gravam em WebM. Passa a aceitar WebM no bucket de vídeos (só acrescenta um tipo).
update storage.buckets
   set allowed_mime_types = array(select distinct unnest(coalesce(allowed_mime_types, '{}') || array['video/webm']))
 where id = 'videos';
