-- Agente Editor de Vídeo: chaves da ElevenLabs (narração com voz de IA) e da Higgsfield (imagens e clipes gerados).
-- Só acrescenta provedores aceitos; nada muda para os que já existem. (aplicada em 21/10/2026)
alter table public.agentes_chaves drop constraint agentes_chaves_provedor_check;
alter table public.agentes_chaves add constraint agentes_chaves_provedor_check check (provedor = any (array['anthropic','openai','google','xai','elevenlabs','higgsfield']));
-- agentes_salvar_chave_ia: aceita 'elevenlabs' e 'higgsfield' (Higgsfield no formato KEY_ID:KEY_SECRET). Ver a função no banco.
