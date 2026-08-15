---
name: Super Trunfo Web
status: final
created: '2026-08-15'
updated: '2026-08-15'
sources:
  - '{planning_artifacts}/prds/prd-SuperTrunfoWeb-2026-08-14/prd.md'
  - '{planning_artifacts}/briefs/brief-SuperTrunfoWeb-2026-08-14/brief.md'
  - '{planning_artifacts}/research/market-super-trunfo-web-brasil-2026-08-14/research.md'
  - 'docs/requisitos_super_trunfo.md'
  - 'docs/carros_specs.csv'
---

# Super Trunfo Web — Experience Spine

## Fundação

Web, **mobile-first**, com versão desktop (RNF-4 do PRD) — layout e decisões de interação partem do menor viewport e escalam para cima, não o contrário. Sem app nativo. Nenhum sistema de UI herdado — componentes próprios, especificados em `DESIGN.md`. Multiplayer em tempo real via WebSocket (RNF-2). Sem login/SSO nesta fase — identificação por nome digitado ao entrar na sala. `DESIGN.md` é a referência de identidade visual; esta spine é o comportamento.

Vocabulário: usa os termos do Glossário do PRD (Carta, Baralho, Grupo, Atributo, Monte, Super Trunfo, Funil, Jogador, Partida, Rodada) verbatim.

## Arquitetura de Informação

| Superfície | Alcançada a partir de | Propósito |
|---|---|---|
| Criar Sala | Link inicial / tela de entrada | Host define nome, o número total de Jogadores da Partida (2-4) e quantos desses são IA, explicitamente. ✅ Refletido no PRD como FR-5 atualizado. → `mockups/key-criar-sala.html` |
| FAQ de Regras | Tela inicial (antes de criar/entrar numa Sala) | Perguntas e respostas com as regras completas do jogo (Baralho, game loop, Super Trunfo + exceção, Funil, fim de jogo) — realiza FR-24 do PRD. **Não aparece em nenhuma superfície da Mesa de Jogo.** → `mockups/key-faq.html` |
| Entrar na Sala | Link de convite recebido | Convidado digita o próprio nome → `mockups/key-entrar-sala.html` (inclui estado de sala cheia/link inválido) |
| Sala de Espera | Após criar/entrar | Mostra quem já entrou, IA preenchendo vagas conforme FR-5; host inicia a Partida → `mockups/key-sala-espera.html` |
| Mesa de Jogo | Início da Partida | Superfície principal — Carta do topo do Jogador, seleção de Atributo, revelação, resultado da Rodada → `mockups/key-mesa-jogo.html` |
| Fim de Partida | Um Jogador reúne as 32 Cartas (FR-22) | Banner de vitória, resumo, opção de nova Partida → `mockups/key-fim-partida.html` |

→ Composição de referência para as 5 superfícies acima: `mockups/` (ver arquivos citados por linha). Spine (este documento e `DESIGN.md`) vence em qualquer conflito com os mockups.

Sem navegação por abas ou menu propriamente dito — o fluxo principal é linear (Criar/Entrar → Espera → Mesa → Fim); a única ramificação é a tela inicial oferecer também um link pra FAQ, que sempre volta pra tela inicial (não tem rota própria dentro do fluxo de jogo). O Funil (retenção de Cartas em empate, FR-18-20) e a exceção da Carta letra "A" (FR-16-17) são **estados da Mesa de Jogo**, não superfícies separadas — ver Padrões de Estado.

## Voz e Tom

Microcópia. A voz e a postura estética vivem em `DESIGN.md.Marca & Estilo`.

| Fazer | Não Fazer |
|---|---|
| "Aguardando 2 de 4 jogadores…" | "Esperando galera chegar! 🎉" |
| "Você venceu a rodada com Velocidade Máxima." | "VOCÊ GANHOU!!! 🏆🔥" |
| Termos do jogo em português direto (Carta, Monte, Rodada) | Jargão técnico exposto ("estado sincronizado", "payload") |
| Tom caloroso mas direto — é pra jogar com família | Tom infantilizado ou hiper-animado |

## Padrões de Componente

Comportamental. Especificação visual vive em `DESIGN.md.Componentes`.

| Componente | Uso | Regras comportamentais |
|---|---|---|
| Carta | Mesa de Jogo — Carta própria (sempre) e Cartas de oponentes após a revelação | Sempre visível para o dono; mostra todos os Atributos. Após a revelação (FR-11), vira (animação de flip) e mostra todos os Atributos das Cartas dos oponentes também; o Atributo selecionado na Rodada fica destacado em todas simultaneamente. **Não mostra nome do modelo nem faixa de cabeçalho colorida** (removidos a pedido do usuário) — a identidade visual da Carta é a foto do carro, a bandeira do país (badge) e o ID Grupo/Letra (badge), não texto. |
| Carta (verso) | Mesa de Jogo — Cartas de oponentes, antes da revelação | Nada identificável visível — só o padrão de marca (amarelo/grade). Nem Atributos, nem foto, nem ID Grupo/Letra aparecem antes da revelação (RNF-3/FR-8: o Jogador não pode inferir nada da Carta do oponente antes da hora). |
| Linha de Atributo | Carta própria, quando é a vez do Jogador | Clicável. Ao clicar, já revela e resolve a Rodada (clique único — ver nota de decisão abaixo). Fora da vez do Jogador, não é clicável. |
| Lista da Sala de Espera | Sala de Espera | Cada linha mostra nome (humano) ou pílula "IA" (bot), atualiza em tempo real conforme gente entra. |
| Banner de Vitória | Mesa de Jogo, após comparação da Rodada; e Fim de Partida | Na Rodada: mostra o vencedor e o valor decisivo, cartas voam (animação) para o Monte do vencedor. Na Partida: confete + nome do vencedor final. Vencedor identificado pelo nome do Jogador, não pelo nome do carro (que não aparece mais em nenhuma Carta). |
| Botão Primário | Criar Sala (criar/iniciar), Fim de Partida (jogar novamente) | Habilitado só quando a ação é válida (nome preenchido, mínimo de 2 Jogadores atingido); desabilitado caso contrário (ver Padrões de Estado). Não tem estado de carregamento próprio nesta rodada — ações são instantâneas do ponto de vista do Jogador. |
| FAQ | Tela Inicial | Lista de perguntas expansíveis (accordion) com as regras do jogo. Read-only — nenhuma ação de jogo parte daqui. Link "Voltar" sempre disponível pra Tela Inicial. |

**Confirmação de seleção de Atributo — decidido:** clique único. O Jogador clica na Linha de Atributo e a Rodada já revela e resolve, sem passo de confirmação intermediário. Decisão tomada após comparar as duas variantes lado a lado em `mockups/key-mesa-jogo.html` — a Variante B (clique + confirmação, ainda visível no mockup como registro da comparação) foi descartada por adicionar fricção a toda Rodada sem benefício claro pro caso de uso (família/amigos, partidas informais).

## Padrões de Estado

| Estado | Superfície | Tratamento |
|---|---|---|
| Nome vazio | Criar Sala / Entrar na Sala | `[ASSUMPTION]` Botão de entrar/criar desabilitado até um nome ser digitado — não discutido, tratamento mínimo assumido. |
| Link inválido ou sala cheia | Entrar na Sala | `[ASSUMPTION]` Mensagem simples ("Esta sala não existe mais" / "Esta sala já está cheia") — não discutido; comportamento exato (redirecionar, permitir nova sala) fica para a Arquitetura. |
| Total de Jogadores fora da faixa | Criar Sala | `[ASSUMPTION]` Host não consegue definir menos de 2 ou mais de 4 Jogadores totais — controle da UI já nasce limitado à faixa (ex: seletor 2-4), sem precisar de mensagem de erro separada. |
| Alguém sai durante a Sala de Espera | Sala de Espera | A pessoa simplesmente some da Lista da Sala de Espera — a Partida ainda não começou, então não há Monte nem estado de jogo a preservar. Se isso deixar uma vaga humana sem preencher, ela vira IA no início da Partida, como qualquer vaga não preenchida (mesma regra da linha "IA preenchendo vaga" abaixo). |
| Aguardando Jogadores | Sala de Espera | Lista cresce conforme convidados entram; host vê botão "Iniciar" habilitado assim que o mínimo de 2 Jogadores (humanos + IA) é atingido. |
| IA preenchendo vaga | Sala de Espera → início da Partida | A quantidade de IA declarada pelo host na criação da Sala entra desde já; além disso, qualquer vaga de Jogador humano ainda não preenchida no momento em que o host clica "Iniciar" também vira IA automaticamente (rede de segurança, mesmo espírito do FR-5 original). |
| Aguardando seleção | Mesa de Jogo | Só o Jogador da vez vê suas Linhas de Atributo clicáveis; os demais veem "Aguardando [nome] escolher…". |
| Revelação | Mesa de Jogo | Todas as Cartas da Rodada viram simultaneamente (FR-11); Atributo selecionado destacado em todas. |
| Empate → Funil | Mesa de Jogo | Cartas da Rodada visualmente movidas para o componente `Funil` (`DESIGN.md.components.funil` — bandeja com borda tracejada `{colors.tie-amber}`) na área central da mesa; mensagem indica novo Atributo a ser escolhido pelo mesmo Jogador (FR-19). |
| Super Trunfo acionado | Mesa de Jogo | Vitória automática visualmente imediata — sem revelação de Atributo — exceto quando um oponente revela Carta letra "A" na mesma Rodada (FR-16), caso em que a Carta "A" é destacada como a vencedora real. Resultado sempre mostrado via `chip-resultado` com texto, nunca só a cor dourada. |
| Jogador eliminado | Mesa de Jogo | Jogador some da rotação de vez; assento marcado com `chip-resultado` (borda `{colors.eliminated-red}` + texto "Eliminado", nunca só a cor), mas outros Jogadores continuam vendo a Partida. |
| Fim de Partida | Fim de Partida | Substitui a Mesa de Jogo; oferece "Jogar novamente" (nova Sala). |
| Conexão perdida | Mesa de Jogo | Um bot assume o assento do Jogador desconectado, seguindo o Monte e o estado dele exatamente de onde parou — a Partida continua sem travar para os demais. ✅ Refletido no PRD como FR-23. **Permanente:** o bot fica com o assento pelo resto da Partida — não há reconexão nesta versão (decisão confirmada pelo usuário, ver `ARCHITECTURE-SPINE.md` AD-9). Se o Jogador original reabrir o link, não há tela/estado específico de retorno — ele simplesmente não recupera o assento. |

## Primitivas de Interação

- **Clique** é a única modalidade de entrada considerada (o usuário descreveu clique de mouse; toque em mobile herda o mesmo padrão — tap equivale a clique).
- Seleção de Atributo: clique único na Linha de Atributo — já revela e resolve a Rodada (decidido, ver Padrões de Componente).
- Nenhum gesto de arrastar, segurar ou multi-toque é usado — mantém a interação simples o suficiente para qualquer familiar jogar sem instrução.
- Animações: viragem de Carta na revelação, Cartas "voando" até o Monte do vencedor, confete + comemoração ao vencer Rodada/Partida — todas confirmadas pelo usuário na Discovery. Som explicitamente descartado nesta fase.
- **Banido:** drag-and-drop de Cartas, gestos complexos, qualquer interação que exija instrução prévia.

## Piso de Acessibilidade

Comportamental. Contraste visual vive em `DESIGN.md`.

- `[ASSUMPTION]` Rigor leve, apropriado a projeto hobby. A interação primária é clique/toque (única modalidade descrita em Primitivas de Interação) — navegação completa por teclado **não está especificada** nesta rodada e não deve ser lida como implementada; fica como Questão em Aberto (§Questões em Aberto) em vez de uma promessa não sustentada pelo resto do documento.
- Toda Linha de Atributo clicável e todo Botão têm, no mínimo, um estado de foco visível ao navegar por Tab (ainda que a interação completa por teclado não seja garantida) — piso mínimo, não pleno suporte a teclado.
- Nenhuma informação de resultado do jogo (vitória, empate, eliminação, identidade da Carta Super Trunfo) depende só de cor — sempre texto ou ícone junto (ver `DESIGN.md.components.chip-resultado` e a faixa "★ SUPER TRUNFO").
- Área de toque mínima 44px em toda Linha de Atributo e botão, mesmo com a tabela de Atributos visualmente densa (ver `DESIGN.md` → Layout & Espaçamento → Densidade vs. toque).
- Animações (confete, flip, cartas voando) respeitam `prefers-reduced-motion` — versão sem movimento mostra o resultado final diretamente.
- Contraste texto/fundo segue `DESIGN.md.colors`: tinta escura sobre papel/laranja/dourado/chips de resultado sempre, nunca texto colorido direto sobre o feltro da mesa. Não testado formalmente com ferramenta de contraste (fora de escopo hobby), mas a regra de "tinta escura sobre superfície clara, sempre" evita as combinações de baixo contraste identificadas nesta rodada de revisão.

## Responsivo & Plataforma

*(Disparado — RNF-4 do PRD exige mobile e desktop; usuário confirmou abordagem **mobile-first**.)*

- **Mobile (base):** layout empilhado — Carta própria fixa na parte inferior da tela (sempre acessível, zona de polegar), Cartas dos oponentes em miniatura no topo, área de revelação/Funil no meio. Todo componente é projetado primeiro para esse viewport; toques grandes o suficiente para dedo, não cursor.
- **Desktop (escala para cima):** layout espacial — Carta própria em destaque na parte inferior central, Cartas dos oponentes distribuídas ao redor da mesa (esquerda/direita/topo conforme número de Jogadores), simulando estar "sentado à mesa". É uma expansão do layout mobile, não um desenho separado.
- Nenhum breakpoint específico definido — `[ASSUMPTION]` fica para a Arquitetura/implementação decidir o ponto de corte exato, mas a base de desenho é sempre o mobile.

## Inspiração & Anti-padrões

*(Disparado — há referência visual real importada.)*

- **Superado — carta de referência "ficha técnica"** (`imports/carta-exemplo-referencia.png`): direção visual da primeira rodada de UX (faixa de cabeçalho colorida, tabela densa tipo ficha técnica impressa). O usuário não gostou dessa linha nesta rodada de Update; a referência atual é a embalagem física (ver abaixo). Mantida no histórico (`imports/`) por rastreabilidade, não como fonte visual ativa.
- **Herdado da embalagem física de referência** (`imports/embalagem-super-trunfo-referencia.jpg`): amarelo vibrante, fundo quadriculado, letras bolha vermelho-laranja com contorno grosso, selo estrelado "COLECIONE", foto do carro em destaque — a identidade pop-art/colecionável agora ativa (ver `DESIGN.md`).
- **Rejeitado — estética de cassino/app de apostas:** neon, gradientes, sons de caça-níquel. O tom é pop-art/colecionável de marca, não excitação de app de apostas — a diferença é fonte (embalagem de brinquedo licenciado) e função (cor com significado, nunca decoração vazia).
- **Rejeitado — onboarding/tutorial explícito durante a Partida:** dado o público (família/amigos que já conhecem o jogo físico), a Mesa de Jogo não ganha tutorial embutido. A FAQ de regras (nova nesta rodada, ver Arquitetura de Informação) é diferente disso — é consulta opcional na Tela Inicial, nunca empurrada durante a Partida.

## Fluxos Principais

### Fluxo 1 — Criar sala e jogar com a família (Mauricio, criando a sala)

1. Mauricio abre o link inicial, digita seu nome, define "4 jogadores, 0 IA" (declarando explicitamente quantos serão bots).
2. Recebe um link de convite e envia para os pais e um amigo.
3. Cada convidado abre o link, digita o próprio nome, entra na Sala de Espera.
4. Mauricio vê a lista crescer em tempo real; quando os 4 estão prontos, clica "Iniciar".
5. A Mesa de Jogo abre para todos simultaneamente — cada um vê sua própria Carta do topo.
6. O Jogador inicial escolhe um Atributo clicando na Linha correspondente — o clique já revela e resolve a Rodada, sem confirmação intermediária (decisão tomada após teste em mockup, ver Padrões de Componente).
7. **Clímax:** todas as Cartas viram ao mesmo tempo, o vencedor é destacado e suas cartas "voam" para o Monte dele — a família inteira vê o mesmo resultado no mesmo instante, em telas diferentes.

Caso de borda: um dos pais fecha a aba durante a Sala de Espera, antes da Partida começar — ele some da Lista da Sala de Espera (ver Padrões de Estado, "Alguém sai durante a Sala de Espera"); se Mauricio não notar e clicar "Iniciar" mesmo assim, a vaga vira IA automaticamente, sem travar os demais.

### Fluxo 2 — IA preenche a mesa (Rafael, sozinho à noite)

*Protagonista ilustrativo — o usuário descreveu esse cenário de forma genérica ("um amigo"); "Rafael" é um nome de exemplo pra dar concretude à jornada, não uma pessoa real confirmada.*

1. Rafael abre o link, digita o nome, entra na Sala de Espera esperando outros dois amigos.
2. Ninguém mais entra em tempo razoável; ele clica "Iniciar" mesmo assim.
3. As vagas não preenchidas são assumidas pela IA — a Sala de Espera mostra a pílula "IA" nos lugares vazios antes de iniciar.
4. **Clímax:** a Mesa de Jogo roda exatamente como no Fluxo 1, com a IA escolhendo Atributos quando ela é o Jogador da vez — Rafael joga uma Partida completa sozinho, sem sentir que o jogo "quebrou" por faltar gente.

Caso de borda: Rafael tenta "Iniciar" sozinho, sem ninguém mais na sala — como o mínimo de 2 Jogadores totais (contando IA) já é satisfeito por ele + pelo menos 1 IA, o botão "Iniciar" está habilitado e a Partida começa normalmente; não existe um caso de "jogador único de verdade" que trave o fluxo.

## Questões em Aberto (UX)

1. ~~Confirmação de seleção de Atributo~~ — **resolvido**: clique único (Variante A), decidido após comparação em mockup. Ver Padrões de Componente e Fluxo 1, passo 6.
2. Fonte tipográfica exata e valores de hex de cor são leituras qualitativas da imagem de referência, não escolhas confirmadas — ver `[ASSUMPTION]`s em `DESIGN.md`.
3. ~~A extensão de FR-5~~ — **resolvido**: incorporado ao PRD (FR-5 atualizado + FR-23) nesta rodada de Update.
4. **Navegação completa por teclado** não foi especificada nesta rodada (rigor leve, hobby) — o piso de acessibilidade cobre só foco visível, não interação completa sem mouse/toque. Revisitar se algum familiar precisar dessa via de acesso.
5. ~~Reconexão pós-desconexão~~ — **resolvido**: não há reconexão nesta versão. A IA assume o assento permanentemente pelo resto da Partida, decisão confirmada pelo usuário (ver PRD FR-23, `ARCHITECTURE-SPINE.md` AD-9).
6. **Conteúdo da FAQ** — a superfície está especificada (onde vive, quando aparece, o que não faz), mas as perguntas e respostas em si não foram escritas nesta rodada. Fica pra uma próxima passada, possivelmente já direto em conteúdo (não é uma decisão de UX, é redação).
7. `[NOTE FOR UX]` **Fotos reais dos carros** — o usuário vai fornecer as imagens depois; até lá, todos os mockups usam o estado de placeholder (`DESIGN.md.components.foto-carro`). Todos os 6 mockups (`mockups/`) já foram re-renderizados com a nova identidade pop-art nesta mesma rodada — falta só substituir o placeholder pela foto real quando ela chegar.
