---
name: Super Trunfo Web
description: Web multiplayer digital do Super Trunfo, tema carros — identidade pop-art/colecionável inspirada na embalagem física original da Grow.
status: final
created: '2026-08-15'
updated: '2026-08-15'
sources:
  - imports/carta-exemplo-referencia.png
  - imports/embalagem-super-trunfo-referencia.jpg
  - mockups/key-criar-sala.html
  - mockups/key-entrar-sala.html
  - mockups/key-sala-espera.html
  - mockups/key-mesa-jogo.html
  - mockups/key-fim-partida.html
  - mockups/key-faq.html
colors:
  yellow-primary: '#F5C518'
  yellow-grid: '#FBE07A'
  red-pop: '#D62828'
  orange-pop: '#F0961D'
  card-paper: '#FFFFFF'
  card-paper-shade: '#F7F3E8'
  table-surface: '#FFF6DE'
  ink-primary: '#1E1712'
  ink-secondary: '#5B5342'
  hairline: '#E8DFC0'
  gold-supertrunfo: '#C9971F'
  win-green: '#2E7D45'
  tie-amber: '#B8860B'
  eliminated-red: '#A3392B'
typography:
  wordmark:
    note: '[ASSUMPTION] Efeito "letra bolha" (contorno grosso + gradiente vermelho→laranja, estilo HQ/colecionável) via peso extra-bold + text-stroke/sombras em camada — não é uma fonte licenciada específica, é uma técnica de renderização sobre uma sans-serif bem pesada (ex: system-ui em 800/900). Usado só no wordmark "Super Trunfo" (tela inicial), nunca em texto de UI corrido.'
  halo-label:
    note: '[ASSUMPTION] Texto preto com contorno branco grosso ("halo"), como "CARROS ESPORTIVOS" na embalagem de referência — usado em rótulos de categoria/badge curtos, nunca em parágrafos ou tabelas.'
  card-label:
    note: '[ASSUMPTION] Sans-serif simples, peso regular, levemente espaçada — rótulos de atributo (Km/h, CV, RPM...). Mantido da direção anterior; não afetado pela mudança de identidade visual.'
  card-value:
    note: '[ASSUMPTION] Mesma família da card-label, peso bold — valores numéricos dos atributos, alinhados à direita.'
  body:
    note: '[ASSUMPTION] Sans-serif de sistema, para textos de interface (botões, sala de espera, mensagens, FAQ) — legibilidade em primeiro lugar, sem efeito comic.'
rounded:
  sm: 6px
  md: 14px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
components:
  carta:
    background: '{colors.card-paper}'
    border: '3px solid {colors.red-pop}'
    radius: '{rounded.md}'
    foto-area-height: '58%'
  foto-carro:
    placeholder: 'silhueta de carro genérica + texto "foto em breve", até o usuário fornecer as imagens reais'
    fit: 'cover, ocupa toda a foto-area-height do card, sem moldura própria além da borda do card'
  carta-super-trunfo:
    border: '4px solid {colors.gold-supertrunfo}'
    badge: 'selo estrelado dourado no canto superior, no espírito do selo "COLECIONE" da embalagem de referência — texto "★ SUPER TRUNFO"'
  badge-pais:
    shape: 'bandeira pequena, radius {rounded.full}, canto superior esquerdo sobre a foto do carro, com o nome do país em texto alternativo/tooltip — não só o ícone. Substitui o antigo texto do nome do país.'
  badge-grupo-letra:
    shape: 'selo circular, radius {rounded.full}, canto superior direito sobre a foto do carro, fundo {colors.ink-primary}, texto {colors.card-paper} (ex: "5B")'
  linha-atributo:
    label-color: '{colors.ink-secondary}'
    value-color: '{colors.ink-primary}'
    divider: '1px solid {colors.hairline}'
    min-height: '44px'
  linha-atributo-selecionada:
    background: '{colors.orange-pop}'
    label-color: '{colors.ink-primary}'
    value-color: '{colors.ink-primary}'
    min-height: '44px'
  botao-primario:
    background: '{colors.red-pop}'
    text-color: '{colors.card-paper}'
    radius: '{rounded.sm}'
    min-height: '44px'
  chip-resultado:
    background: '{colors.card-paper}'
    text-color: '{colors.ink-primary}'
    shape: 'selo estrelado/starburst, no espírito do selo "COLECIONE" da embalagem — não uma pílula genérica'
    border-vitoria: '3px solid {colors.win-green}'
    border-empate: '3px solid {colors.tie-amber}'
    border-eliminado: '3px solid {colors.eliminated-red}'
  carta-verso:
    background: '{colors.yellow-primary}'
    grid-overlay: '{colors.yellow-grid}, linhas finas, no espírito do fundo quadriculado da embalagem'
    mark-color: '{colors.ink-primary}'
    radius: '{rounded.md}'
  lista-sala-espera:
    background: '{colors.card-paper}'
    divider: '1px solid {colors.hairline}'
    pill-ia:
      background: '{colors.ink-primary}'
      text-color: '{colors.card-paper}'
      radius: '{rounded.full}'
  banner-vitoria:
    base: '{components.chip-resultado}'
    elevated-surface: '{colors.card-paper}'
  funil:
    background: '{colors.card-paper}'
    grid-overlay: '{colors.yellow-grid}'
    border: '3px dashed {colors.tie-amber}'
    label-color: '{colors.ink-primary}'
    radius: '{rounded.md}'
  faq:
    background: '{colors.card-paper}'
    accent: '{colors.yellow-primary}'
    question-color: '{colors.ink-primary}'
---

## Marca & Estilo

Super Trunfo Web troca a postura de "ficha técnica séria" por algo mais fiel ao objeto que gerou a paixão: a embalagem física do jogo (`imports/embalagem-super-trunfo-referencia.jpg`) — amarelo vibrante, fundo quadriculado, o logotipo "Super Trunfo" em letras bolha vermelho-laranja com contorno grosso e efeito 3D, um selo estrelado "COLECIONE", a foto do carro em destaque, rótulos em preto com contorno branco. É pop-art, colecionável, brincalhão — o oposto de uma UI corporativa ou de um app de apostas.

O amarelo e a grade quadriculada são a assinatura de marca — aparecem na tela inicial, no verso das Cartas, no Funil e em selos de resultado. Dentro da própria Carta (frente, revelada), a foto do carro e a tabela de Atributos ficam sobre `{colors.card-paper}` branco limpo — o amarelo pop-art é a moldura da experiência, não o fundo de cada dado que precisa ser lido rapidamente durante o jogo.

`[ASSUMPTION]` A Mesa de Jogo (fundo da tela durante a Partida) usa `{colors.table-surface}` — um creme quente bem mais claro que o amarelo pleno da embalagem — em vez do amarelo vibrante em tela cheia. Decisão de compromisso: manter a identidade (tom quente, aparentado ao amarelo da marca) sem cansar a vista numa Partida que pode durar vários minutos com atenção sustentada. Se o usuário preferir o amarelo pleno também na Mesa, é uma troca de um token só.

## Cores

- **Amarelo Primário (`{colors.yellow-primary}`)** é a cor de marca — usada na tela inicial, no verso das Cartas, em selos e badges. Não é o fundo da Carta revelada (isso é `{colors.card-paper}`, branco, para legibilidade da tabela de Atributos).
- **Grade Amarela (`{colors.yellow-grid}`)** é o padrão de linhas finas sobre superfícies amarelas, ecoando o fundo quadriculado da embalagem — decorativo, nunca atrás de texto direto.
- **Vermelho Pop (`{colors.red-pop}`)** é a cor de ação primária (Botão Primário, borda das Cartas comuns) e a cor-base do efeito "letra bolha" do wordmark. Contraste alto o suficiente para texto branco em cima (`{colors.card-paper}`) — diferente do laranja/amarelo, que exigem texto escuro.
- **Laranja Pop (`{colors.orange-pop}`)** é o parceiro de gradiente do vermelho no wordmark, e a cor de destaque da Linha de Atributo selecionada. **Texto sobre laranja é sempre `{colors.ink-primary}` (escuro)** — mesma regra de contraste já validada na direção anterior.
- **Dourado do Super Trunfo (`{colors.gold-supertrunfo}`)** é reservado exclusivamente para a Carta com a flag Super Trunfo — borda grossa e um selo estrelado dourado (no espírito do selo "COLECIONE" da embalagem), com o texto "★ SUPER TRUNFO" — nunca só a cor.
- **Papel da Carta (`{colors.card-paper}`)** é o fundo branco limpo da Carta revelada e de qualquer superfície onde dado precisa ser lido rápido (tabela de Atributos, Lista da Sala de Espera, FAQ). `{colors.card-paper-shade}` é um branco levemente amarelado, para separação visual sutil sem sair da família de cor.
- **Tinta (`{colors.ink-primary}` / `{colors.ink-secondary}`)** são os textos — primário para valores de Atributo e rótulos importantes, secundário para rótulos de apoio.
- **Verde de Vitória, Âmbar de Empate, Vermelho de Eliminação** continuam estritamente semânticos, sempre como borda de um `{components.chip-resultado}` com texto — nunca cor sozinha, nunca texto direto sobre uma superfície amarela ou de baixo contraste (regra herdada da revisão de acessibilidade da rodada anterior, ainda válida aqui).

`[NOTE FOR UX]` Tema único (sem alternância claro/escuro) — não discutido na Discovery, mesma situação da rodada anterior.

Evitar: qualquer cor fora da paleta acima usada como decoração pura; texto colorido direto sobre superfícies de baixo contraste; informação crítica do jogo comunicada só por cor, sem texto de apoio; o efeito "letra bolha" fora do wordmark (não usar em texto de UI corrido — vira ilegível e foge do tom).

## Tipografia

O wordmark "Super Trunfo" (tela inicial) usa `{typography.wordmark}` — o efeito "letra bolha" vermelho-laranja da embalagem. Rótulos curtos de categoria/badge usam `{typography.halo-label}` (preto com contorno branco). Nenhum dos dois aparece em texto corrido, parágrafo ou tabela — são efeitos de impacto pontual, não uma família de leitura.

Rótulos de Atributo em `{typography.card-label}`, valores em `{typography.card-value}` (peso mais forte, alinhados à direita). Texto de interface (botões, sala de espera, FAQ) em `{typography.body}`, sem nenhum efeito decorativo — a FAQ em particular precisa ser a superfície mais "calma" tipograficamente, já que existe pra ser lida com atenção.

## Layout & Espaçamento

Escala: 4 / 8 / 12 / 16 / 24 / 32 / 48px. Dentro da Carta, os espaçamentos são mais apertados (`{spacing.2}`/`{spacing.3}`) na tabela de Atributos; a foto do carro (`{components.foto-carro}`) não tem padding interno — vai de borda a borda dentro da moldura vermelha do card, maximizando o impacto visual que o usuário pediu.

Desenho **mobile-first**: a Mesa empilha verticalmente (Carta própria embaixo, Cartas dos oponentes em cima, menores) como layout base; desktop escala esse mesmo layout para algo mais espacial. Ver EXPERIENCE.md → Responsivo & Plataforma.

**Densidade vs. toque:** cada Linha de Atributo mantém `min-height: 44px` como área de toque real via padding interno, mesmo com a tabela visualmente compacta.

## Elevação & Profundidade

Cartas sobre a Mesa recebem uma sombra suave e curta — o suficiente para lerem como objetos físicos, não flutuando. A Carta selecionada ou em revelação ganha uma sombra levemente mais forte, como se fosse erguida da mesa. Nada de sombras dramáticas ou brilho — a moldura vermelha grossa já dá o impacto visual, a elevação é sutil.

## Formas

`{rounded.md}` (14px) para o corpo da Carta — cantos mais arredondados que a direção anterior, mais próximos de um cartão colecionável moderno (tipo álbum de figurinhas) do que de uma ficha técnica reta. `{rounded.sm}` para botões e a Linha de Atributo destacada. `{rounded.full}` para os selos/badges circulares (país, Grupo/Letra, pílula de IA).

## Componentes

*Nomes de componente idênticos aos usados em `EXPERIENCE.md` → Padrões de Componente. Onde as imagens de referência importadas e esta especificação divergem, **esta especificação vence** — as fotos são inspiração, não contrato.*

- **Carta** — `{colors.card-paper}` com moldura grossa `{colors.red-pop}` (ou `{colors.gold-supertrunfo}` + selo estrelado, se for a Carta Super Trunfo). **Sem faixa de cabeçalho colorida e sem nome do modelo** — removidos a pedido do usuário. No lugar, sobre a foto do carro: `{components.badge-pais}` (bandeira, canto superior esquerdo) e `{components.badge-grupo-letra}` (ID, canto superior direito). A foto do carro (`{components.foto-carro}`) domina ~58% da altura do card — é o elemento central, não um detalhe. Abaixo, a tabela de Atributos (`{components.linha-atributo}`).
- **Carta (verso)** — usada para as Cartas dos oponentes antes da revelação. Fundo `{colors.yellow-primary}` com `{components.carta-verso.grid-overlay}` (grade fina) e o wordmark/símbolo genérico do jogo centralizado — sem Grupo/Letra, ID, foto ou Atributo algum (RNF-3/FR-8: nada que identifique a Carta pode aparecer antes da revelação). Reforça a identidade de marca exatamente no momento em que nenhum dado de jogo pode vazar.
- **Linha de Atributo** — clicável quando é a vez do Jogador escolher; ao clicar, vira `{components.linha-atributo-selecionada}` (fundo laranja, texto escuro). Área de toque mínima `44px`.
- **Botão Primário** — `{colors.red-pop}` com texto branco (`{colors.card-paper}`), usado para ações centrais (criar sala, iniciar Partida, jogar novamente). Altura mínima `44px`. Estado desabilitado: `{colors.hairline}` de fundo, texto `{colors.ink-secondary}`.
- **Lista da Sala de Espera** — uma linha por Jogador esperado: nome (humano) em `{typography.body}`, ou uma `pill-ia` (fundo escuro, texto claro) para vagas de IA — sobre `{colors.card-paper}`, divisores `{colors.hairline}`.
- **Chip de Resultado** — agora um selo estrelado/starburst (não mais uma pílula simples), citando diretamente o selo "COLECIONE" da embalagem: fundo `{colors.card-paper}`, borda grossa na cor semântica (`{colors.win-green}`, `{colors.tie-amber}`, `{colors.eliminated-red}`), texto sempre presente ("Você venceu", "Empate — Funil", "Eliminado") — nunca só a cor/forma.
- **Banner de Vitória** — usa o Chip de Resultado (agora starburst) como base, sobreposto à Mesa ao fim de uma Rodada ou Partida, com animação de confete.
- **Funil** — a área central da Mesa onde Cartas empatadas ficam retidas (FR-18): cartão em `{colors.card-paper}` com `{colors.yellow-grid}` sutil de fundo e borda tracejada `{colors.tie-amber}`.
- **FAQ** — lista de perguntas e respostas sobre `{colors.card-paper}`, com `{colors.yellow-primary}` usado só como acento (ex: um filete ao lado de cada pergunta, ou o ícone de expandir/recolher) — nunca como fundo de bloco de texto longo, para não cansar a leitura.

## O Que Fazer e Não Fazer

| Fazer | Não Fazer |
|---|---|
| Amarelo + grade quadriculada como assinatura de marca (tela inicial, verso da carta, selos) | Amarelo pleno atrás de texto longo ou tabela de dados |
| Foto do carro como elemento central e dominante do card | Card sem foto, ou foto pequena/decorativa |
| Selo estrelado ("COLECIONE") para resultado e Super Trunfo | Pílula genérica sem relação com a marca |
| Texto branco sobre vermelho, texto escuro sobre laranja/amarelo/papel | Texto de baixo contraste em qualquer combinação |
| Efeito "letra bolha" só no wordmark da tela inicial | Efeito "letra bolha" em texto de UI, tabela ou FAQ |
| Toda informação de resultado com texto + cor (Chip de Resultado) | Verde/âmbar/vermelho como único portador de significado |
| Área de toque mínima 44px em toda Linha de Atributo e botão | Encolher o alvo de toque pra caber mais densidade visual |
