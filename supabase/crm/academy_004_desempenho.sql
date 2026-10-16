-- 061: com 23 mil contatos (importação do SellFlux) o plano genérico de contatos_filtrados
-- estimava 2 linhas e fazia laço aninhado com contato_resumo (96 milhões de comparações, 8-15 s → timeout na tela Contatos).
-- Sem laço aninhado vira hash join: ~60 ms.
alter function contatos_filtrados(jsonb) set enable_nestloop = off;
