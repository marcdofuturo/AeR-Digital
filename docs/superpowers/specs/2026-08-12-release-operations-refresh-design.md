# Refresh Operacional de Lancamentos

## Objetivo

Atualizar o painel AeR Digital para o fluxo operacional atual: menu recolhivel, intake via WhatsApp copiavel, catalogo por artista, modal de lancamento completo, autorizacoes geradas por participantes, registros sem YouTube Content ID, splits automaticos/editaveis e apresentacoes com Claude.

## Escopo

- O frontend continua em `apps/web`, com dados server-side via Supabase admin client sempre filtrado por `tenant_id`.
- O motor puro de splits em `packages/splits` reflete a regra atual: todos os participantes entram na obra; no fonograma o selo permanece como produtor fonografico com 41,70%, produtores entram como musicos acompanhantes, e o digital respeita a configuracao do selo.
- A tela "Pitch" passa a se chamar "Apresentacao" na interface. A rota interna pode permanecer `/pitch` para preservar links existentes.
- Creditos de IA usam a tabela existente `pitches`: cada linha gerada consome 2 creditos de um limite de 100 por tenant.
- A capa no modal so renderiza imagem quando `cover_url` e uma URL navegavel. Placeholders como `received` viram estado visual sem imagem quebrada.

## UX

- O menu lateral desktop alterna entre 256px e uma versao compacta com icones. O botao usa simbolo de voltar musica.
- O dashboard exibe "Envie sua Musica pelo WhatsApp" e permite copiar o link com um clique.
- A ficha completa integra Creditos na Visao Geral, sem a coluna "Oculto".
- Campos ausentes de nome civil e codigo ECAD aparecem inline e salvam no artista, reaproveitando a informacao em todos os lancamentos.
- Registros de obra e fonograma incluem area de adicionar participante por faixa.
- Autorizacao passa a ter documento preenchido automaticamente por faixa, com visualizacao no painel, download DOCX e email de liberacao salvo por artista.
- A Visao Geral vira a area de edicao/copia operacional: dados de lancamento, faixa, ISRC, UPC, agregadora, capa/audio e dados ECAD salvam no banco e espelham para as outras abas.

## Dados e Falhas Corrigidas

- A tela de artistas deve buscar via admin client e selecionar `releases.id`; a versao anterior montava links com `rel.release_id`, que nao existe.
- Autorizações deixam de depender de uma lista criada manualmente para aparecer: a pagina garante checklist por participante.
- Registros antigos de `youtube_cid` podem continuar no banco, mas nao aparecem mais na UI nem no pipeline atual.
- Splits podem ser regenerados automaticamente para faixas sem split e editados manualmente por nova versao.
- O WhatsApp pergunta se o envio e single ou album/EP, aceita quantidade de faixas no album e adiciona o comando `voltar` em todas as perguntas.
- Ao receber audio com nome de arquivo, o fluxo tenta sugerir nome da musica e participantes pelo padrao `Artista - Musica.ext` e pede correcao em lista quando necessario.
- Apresentacao usa `lyrics_transcript` quando disponivel, preservando o pipeline original do `apps/audio-svc`; a chamada Claude deve usar web search para pesquisar relevancia publica dos artistas. Se a chave Anthropic retornar 401, o painel salva fallback local e registra aviso operacional.

## Testes

- Testes unitarios cobrem o motor de splits, helpers de apresentacao, copy de intake, tabs, modal, artistas e actions puras.
- Testes de pagina/Playwright devem validar login, dashboard, abertura de modal, ficha completa, artistas, splits, registros e apresentacao sem quebrar console.
