# Regras do Agente de Marketing

Fixadas pelo Alexandre em 18/10/2026. Qualquer mudança nas telas ou na função do agente segue estas regras.

## As 6 regras

1. **Período livre.** Ver e criar por peça única, dia, semana, mês ou intervalo de datas. Filtrar um dia só muda o que aparece; não obriga a gerar conteúdo.
2. **Canal antes do formato.** Primeiro se escolhe o canal (Instagram, YouTube, TikTok…). Só depois aparecem os formatos daquele canal.
3. **Campos específicos.**
   - "Telas por sequência" aparece só para stories.
   - Vídeo tem duração desejada e orientações de roteiro e gravação.
4. **Campanha opcional.** Dá para fazer conteúdo educativo e de relacionamento sem ligar a uma oferta. Cada pedido tem objetivo e público.
5. **Planejar e gerar são separados.**
   - "Salvar planejamento" cria as peças como ideias, sem IA e sem custo.
   - "Gerar rascunhos" pede os textos ao agente.
6. **Filtros preservados.** Período, canal, campanha, formato, situação e busca continuam selecionados ao alternar entre Quadro e Calendário, e ao ir para a Produção e voltar.

## Duas entradas, um editor (18/10/2026)

| | Nova peça com IA | Planejar conteúdos |
|---|---|---|
| Para quê | Desenvolver **um** conteúdo | Organizar **um conjunto** |
| Começa com | Uma conversa: "O que você quer comunicar?" | Direção: período, objetivo, público, campanha, canais, volume, dias |
| O agente devolve | A proposta de uma peça (canal, formato, título, abordagem) | Um calendário editorial proposto (temas, canais, formatos, datas) |
| Próximo passo | "Salvar ideia" ou "Confirmar e criar roteiro" | Revisar, editar, ajustar com a IA e "Aprovar plano" → as peças vão para Ideias |

- As duas chegam ao **mesmo editor por peça**, na Produção.
- A proposta do plano fica escondida do quadro e do calendário até ser aprovada.
- Os roteiros são escritos depois: uma, algumas ou todas as peças.
- **Funciona sem IA:** cada peça tem o botão "Escrever eu mesmo". A equipe pode planejar e escrever tudo à mão; o agente é ajuda, não obrigação.
- **Mês fechado:** o filtro "Mês" mostra só os dias daquele mês (outubro = 1 a 31).
- Calendário: o "+" de cada dia cria uma peça naquela data.

## Padrão das telas (18/10/2026)

- Planejamento e Produção usam **as mesmas barras**: título da aba, período de visualização e filtros.
- A data fica sempre no mesmo lugar, ao lado dos botões Dia / Semana / Mês / Período (na Produção existe também "Todos").
- Os filtros estão sempre na mesma ordem: Campanhas, Planejamentos, Canais, Formatos, Situações. A busca fica à direita.
- Quadro / Calendário fica no cabeçalho do Planejamento.
- Os canais aparecem com o logo deles.
- **Nome dos formatos depende do canal.**
  - Com um canal só, aparece o nome que a rede usa: Reels, Shorts, Vídeo curto do TikTok.
  - Com vários canais, aparece o nome geral e onde o formato existe. Ex.: "Vídeo curto vertical · Instagram, YouTube, TikTok"; "Vídeo longo horizontal · YouTube".
  - Ao tirar um canal, o formato que ele não tem sai do filtro.

## Cadastro de redes sociais

- O cadastro fica em **Base da marca → Redes sociais**. Ali se liga ou desliga cada canal e se registra o perfil (@ ou link).
- Só os canais ligados aparecem nos filtros, no planejamento e na criação de peças.
- O agente só propõe e escreve para os canais ligados e usa os perfis cadastrados.
- Catálogo disponível: Instagram, YouTube, TikTok, Facebook, LinkedIn, Pinterest e Threads.
- Uma rede nova (X, WhatsApp, e-mail…) precisa de formatos e de um guia de escrita próprios, por isso entra por desenvolvimento.

## Telas do Planejamento (modelo do GPT, 18/10/2026)

- Um painel só com o período e os filtros. Cada filtro tem o rótulo em cima.
- Embaixo do painel fica o resumo ("12 peças no período · 19 – 31/10") e o "Limpar filtros".
- **Quadro:** cada coluna tem a cor da etapa, a contagem, um "+" para criar e o estado vazio "Nenhuma peça".
- **Calendário:** mostra uma semana por vez. No mês e no período há setas e "Semana 1 de 2".
- **Cartão:** tem o logo do canal, o formato, o título, a data ou horário e a situação.
- **Menu ⋯ do cartão:** abrir a peça, mover para outra etapa ou tirar do planejamento.

## Canais

- **Primeira fase:** Instagram, YouTube e TikTok.
- **Depois:** Facebook, LinkedIn, WhatsApp e e-mail. A estrutura já está pronta, mas eles ficam escondidos até serem ligados.

Formatos de cada canal:

**Canal, formato e finalidade são separados:**
- O **canal** diz onde a peça sai. Exemplo: YouTube.
- O **formato** diz o que a peça é. Exemplo: vídeo curto.
- A **finalidade** (objetivo do briefing) diz para que serve. Exemplo: educativo ou anúncio.

Capa, thumbnail e legenda são materiais dentro da peça, não peças separadas. Cada formato tem nomes próprios para esses campos no editor; por exemplo, no e-mail os campos são "Assunto", "Prévia" e "Corpo". Esses nomes ficam em `formatos.ts`.

| Formato | O agente prepara |
|---|---|
| Imagem | Texto da arte, legenda e pedido da imagem |
| Carrossel | Texto de cada lâmina, legenda e direção visual |
| Vídeo curto | Roteiro cena a cena, legenda e capa |
| Stories | Texto de cada tela e interações |
| Vídeo longo | Roteiro em blocos, título, descrição e thumbnail |
| Live | Pauta, roteiro, perguntas e chamada |
| Texto / enquete | Texto, pergunta e opções de resposta |
| Artigo | Estrutura, conteúdo e sugestão de capa |
| E-mail | Assunto, prévia, corpo e chamada |
| Mensagem | Mensagem e variações (WhatsApp) |
| Material PDF | Conteúdo página a página e orientação de diagramação |

| Canal | Formatos (nome no canal) |
|---|---|
| Instagram | Imagem, Carrossel, Reels, Stories, Live |
| YouTube | Vídeo longo, Shorts, Live, Imagem e Texto/enquete na comunidade |
| TikTok | Vídeo, Carrossel de fotos, Stories, Live |
| Facebook | Imagem, Carrossel, Reels, Stories, Texto/enquete, Live |
| LinkedIn | Imagem, Carrossel em PDF, Vídeo, Texto/enquete, Artigo/newsletter, Live |
| Pinterest | Pin, Pin carrossel, Pin em vídeo |
| Threads | Texto/enquete, Imagem, Carrossel |
| E-mail | E-mail, Material PDF |
| WhatsApp | Mensagem, Material PDF |
| Site | Artigo do blog, Material PDF |

- Os canais são ligados em Base da marca → Redes sociais. Os filtros e o agente só usam os canais ligados.
- Produção: cada linha mostra o ícone do formato, o canal (logo), a data, a situação ("Roteiro em revisão", "Texto em revisão"…), o menu ⋯ e a paginação.

## Uma ideia em vários canais

- Exemplo: para amanhã, um vídeo de YouTube, um TikTok e um carrossel, todos sobre o mesmo assunto.
- Com "Adaptar a abordagem para cada canal" marcado, o agente parte de uma ideia central.
- Ele adapta a abertura, a profundidade e a chamada de cada canal.

## Já decidido antes

- Nada é publicado sozinho; tudo vira rascunho para aprovar.
- Etapas do quadro:
  1. Ideias
  2. Em produção (o agente está escrevendo)
  3. Em revisão
  4. Pronto (= aprovada)
  5. Publicado (= postada)
- Memória: o agente aprende com:
  - os ajustes com "Lembrar";
  - os motivos de descarte;
  - o que a equipe ensina;
  - as peças aprovadas.
- Preços, condições e bônus só vêm de **Base da marca → Ofertas e materiais**.
- Imagem: o Claude não gera imagem. Essa parte vai ser do Agente de Arte, pela API de imagem (recomendação: OpenAI GPT Image).
