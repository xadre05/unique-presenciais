-- 061: com 23 mil contatos (importação do SellFlux) o plano genérico de contatos_filtrados
-- estimava 2 linhas e fazia laço aninhado com contato_resumo (96 milhões de comparações, 8-15 s → timeout na tela Contatos).
-- Sem laço aninhado vira hash join: ~60 ms.
alter function contatos_filtrados(jsonb) set enable_nestloop = off;

-- 062: atualizar_resumo_contatos levava 13 s (o "ou" telefone/e-mail na busca de alunos presenciais não usa índice)
-- e estourava o limite de 8 s do app: o resumo dos contatos importados não era gravado. O trecho "pres" virou:
--   select c.id from alunos a join matriculas m on m.aluno_id = a.id and m.status <> 'cancelada'
--     join crm_contatos c on c.empresa_id = empresa_unique() and c.telefone = crm_tel_br(a.whatsapp)
--   union
--   select c.id from alunos a join matriculas m on m.aluno_id = a.id and m.status <> 'cancelada'
--     join crm_contatos c on c.empresa_id = empresa_unique() and c.emails @> array[lower(a.email)]
-- 063: segmento "marcado" também reconhece as etiquetas da limpeza do SellFlux:
--   'sf-comprou', 'sf-abandonou-carrinho', 'sf-gerou-pix-boleto'
