---
title: Super Trunfo Web
created: 2026-08-14
updated: 2026-08-15
status: final
---

# PRD: Super Trunfo Web
*Nome mantido deliberadamente por enquanto (uso pessoal/privado) — revisitar apenas se o projeto sair do círculo pessoal, ver §8.2.*

## 0. Propósito do Documento

Este PRD formaliza os requisitos do Super Trunfo Web para orientar a arquitetura e a quebra em épicos/histórias que vêm a seguir. Ele constrói sobre documentos já existentes, sem duplicá-los: o **documento de requisitos técnicos** (`docs/requisitos_super_trunfo.md`, RF01-RF06 e RNF01-RNF04), a **pesquisa de mercado** (`_bmad-output/planning-artifacts/research/market-super-trunfo-web-brasil-2026-08-14/research.md`), o **brief de produto** (`_bmad-output/planning-artifacts/briefs/brief-SuperTrunfoWeb-2026-08-14/brief.md`) e a **UX** (`_bmad-output/planning-artifacts/ux-designs/ux-SuperTrunfoWeb-2026-08-15/` — `DESIGN.md` + `EXPERIENCE.md`), cujas decisões de comportamento retroalimentaram alguns FRs deste documento (ver notas `[NOTE FOR PM]` em §4.2). É um projeto hobby: o rigor aqui é proporcional a isso — sem seções de compliance, ROI ou stakeholders formais.

## 1. Visão

Super Trunfo Web é a versão digital multiplayer do jogo de cartas Super Trunfo, com baralho temático de carros, que faltava existir. Duas a quatro pessoas (com IA preenchendo vagas vazias) jogam em tempo real pelo navegador, com todas as regras do jogo físico — incluindo a carta especial e o desempate — automatizadas e corretas.

Não é um produto comercial: é um projeto de aprendizado e diversão, para jogar com família e amigos. Mas o terreno em que ele pousa está genuinamente vazio — nenhuma versão digital ativa do Super Trunfo com multiplayer real pela internet existe hoje, nem mesmo da própria detentora da marca. A pesquisa de mercado que embasa este PRD é honesta sobre o limite disso: ausência de concorrência é validação parcial, não prova de demanda — pode significar oportunidade, ou pode significar que ninguém provou que essa demanda existe. Para um projeto hobby isso não muda a decisão de construir; fica registrado para não virar premissa não-examinada caso o projeto avance além do círculo pessoal.

Se algum dia isso ultrapassar o uso pessoal, o ângulo de posicionamento mais forte identificado na pesquisa não é técnico — é nostalgia: o público que jogava Super Trunfo físico quando criança é hoje a maior coorte de jogadores adultos no Brasil. Este PRD não persegue esse posicionamento agora (não há GTM em escopo — ver §5, §6.2), mas registra o ângulo para uma eventual revisão de visão.

## 2. Público-Alvo

### 2.1 Jobs To Be Done

- Como criador do projeto, quero construir um sistema de jogo em tempo real (WebSocket, lógica de estado, sincronização) para aprender fazendo algo divertido — esse é um JTBD válido por si só.
- Como jogador, quero reunir família e amigos numa partida de Super Trunfo à distância, sem precisar estar todos juntos fisicamente ou na mesma rede.
- Como jogador, quero que as regras (incluindo casos especiais como a carta Super Trunfo e o desempate) sejam aplicadas automaticamente e corretamente, sem depender de alguém arbitrar manualmente.
- Como jogador, quero poder jogar mesmo quando não há gente suficiente conectada, com a IA preenchendo as vagas.
- Como jogador, quero conseguir relembrar as regras (inclusive casos especiais como a exceção da carta letra "A" e o funil de desempate) sem precisar perguntar pra alguém ou parar a Partida — daí a FAQ de regras (ver §4.7).

### 2.2 Público Secundário (potencial, não perseguido)

Adultos brasileiros de 30-44 anos que jogavam Super Trunfo físico quando crianças — a coorte que a pesquisa de mercado identifica como a maior entre os jogadores adultos do Brasil, e para quem nostalgia é driver de consumo comprovado. `[ASSUMPTION]` Não é endereçado ativamente nesta fase; registrado como direção plausível caso o projeto avance além do círculo pessoal (herdado do brief, §Quem Isso Atende).

### 2.3 Não-Usuários (v1)

- Jogadores desconhecidos buscando partida pública (sem matchmaking com estranhos nesta fase — ver §6.2).
- Qualquer público que exija uma experiência comercial polida, sem bugs, com suporte — este é um projeto hobby.

### 2.4 Jornadas de Usuário Principais

*Escala leve, apropriada a projeto hobby/solo — uma frase por jornada.*

- **UJ-1. Convite e partida com a família.** Mauricio, tendo acabado de terminar o baralho de carros, manda o link para os pais e um amigo, os quatro entram por navegadores diferentes, e uma partida completa roda do início (embaralhar e distribuir) ao fim (um jogador com as 32 cartas) sem travar.
- **UJ-2. IA preenche a mesa.** Um amigo, sozinho em casa à noite, abre o jogo esperando outros dois amigos entrarem; como só ele se conecta, a IA assume as outras vagas e a partida começa do mesmo jeito, com as mesmas regras.

## 3. Glossário

- **Carta** — unidade do baralho, identificada por grupo (1-8) + letra (A-D), com atributos numéricos fixos e, em uma única carta, a flag Super Trunfo.
- **Baralho** — conjunto de 32 Cartas jogáveis, organizado em 8 Grupos de 4 Cartas.
- **Grupo** — categoria temática de 4 Cartas (ex: um país ou categoria de carro).
- **Atributo** — característica numérica de uma Carta (ex: Velocidade Máxima, Potência) usada na comparação da Rodada.
- **Monte** — pilha privada de Cartas de um Jogador, em fila FIFO; apenas a carta do topo é visível/jogável.
- **Super Trunfo** — a única Carta do Baralho com a flag especial de vitória automática (sujeita à exceção da Carta letra A — ver FR-16).
- **Funil** — o container temporário que retém as Cartas de uma Rodada empatada até o desempate ser resolvido.
- **Jogador** — participante da Partida, humano ou controlado por IA.
- **Partida** — uma sessão completa de jogo, do embaralhamento inicial até um Jogador reunir as 32 Cartas.
- **Rodada** — um ciclo de seleção de Atributo, comparação e definição de vencedor dentro de uma Partida.

## 4. Funcionalidades

### 4.1 Baralho e Estrutura de Cartas

**Descrição:** O sistema instancia o Baralho de 32 Cartas no início de cada Partida, com identificação, Grupo, Atributos e a flag Super Trunfo definidos conforme `docs/requisitos_super_trunfo.md` (RF01). O tema é carros de determinados países — um único Baralho nesta fase (ver §5, Não-Metas).

**Requisitos Funcionais:**

#### FR-1: Instanciação do Baralho
O sistema instancia um Baralho com exatamente 32 Cartas jogáveis a cada nova Partida.
**Consequências (testáveis):**
- Toda Partida nova tem exatamente 32 Cartas distintas.
- Nenhuma Carta é repetida dentro do mesmo Baralho.

#### FR-2: Identificação e Atributos da Carta
Cada Carta possui identificação única (Grupo 1-8 + letra A-D, ex: `1A`) e um conjunto fixo de Atributos numéricos (ex: Velocidade Máxima, Potência (CV/HP), RPM Máximo, Cilindrada, Aceleração 0-100 km/h, Qtd. Cilindros).
**Consequências (testáveis):**
- Toda Carta tem um identificador único no formato `{grupo}{letra}`.
- Todo Atributo listado existe com um valor numérico em toda Carta.

#### FR-3: Carta Super Trunfo
O sistema define exatamente uma Carta do Baralho com a flag Super Trunfo.
**Consequências (testáveis):**
- Exatamente uma Carta por Baralho carrega a flag.

#### FR-4: Agrupamento Temático
As Cartas são organizadas em 8 Grupos de 4 Cartas cada, por categoria/país.
**Consequências (testáveis):**
- Toda Carta pertence a exatamente um Grupo.
- Todo Grupo tem exatamente 4 Cartas.
- Os modelos de carro usados vêm de montadoras/países diversos (RF01.6 do documento técnico) — propriedade do conteúdo do Baralho, não um comportamento de sistema testável por si só; satisfeita pela composição de `docs/carros_specs.csv`, que já inclui uma coluna `Pais` (5 países representados: Alemanha, Itália, Reino Unido, Estados Unidos, França).

**Notas:** Os dados reais de carros (32 modelos, com Velocidade Máxima, Potência CV/HP, RPM Máximo, Cilindrada, Aceleração 0-100 km/h e Qtd. Cilindros) estão definidos em `docs/carros_specs.csv`, já incluindo ID (`Grupo+Letra`), Grupo (1-8), Letra (A-D) e País da montadora — atribuídos de forma não-sequencial (embaralhada) em relação à ordem original do arquivo, a pedido do usuário — e a coluna `SuperTrunfo` (todas as 32 Cartas como `false` por enquanto; qual Carta recebe a flag fica para decisão posterior do usuário — ver Questão em Aberto §8.1). O uso de marcas/modelos reais de montadoras carrega uma questão de marca registrada distinta da já mapeada para "Super Trunfo" no brief; decisão consciente do usuário de tratar como uso interno por enquanto e revisitar apenas se o projeto virar produto (mesma postura adotada para a marca "Super Trunfo" — ver §Riscos do brief).

### 4.2 Partida e Jogadores

**Descrição:** Uma Partida suporta de 2 a 4 Jogadores; vagas não preenchidas por humanos são assumidas pela IA, seja por declaração explícita do host na criação da sala, por rede de segurança no início da Partida, ou por substituição em caso de desconexão em andamento (RF02, refinado pela UX). Realiza UJ-1, UJ-2.

**Requisitos Funcionais:**

#### FR-5: Suporte a Múltiplos Jogadores com Preenchimento por IA
O sistema suporta Partidas de 2 a 4 Jogadores. Ao criar a sala, o host declara explicitamente o número total de Jogadores e quantos desses são IA. Qualquer vaga humana ainda não preenchida no momento em que a Partida é iniciada também é assumida pela IA automaticamente (rede de segurança). Realiza UJ-2.
**Consequências (testáveis):**
- A quantidade de IA declarada pelo host entra na Partida desde a criação da sala.
- Uma vaga humana não preenchida até o host iniciar a Partida também vira IA, mesmo que não tenha sido declarada como tal na criação.
- Uma Partida nunca inicia com menos de 2 Jogadores totais (humanos + IA).

`[NOTE FOR PM]` Refinamento incorporado a partir da UX (ver `_bmad-output/planning-artifacts/ux-designs/ux-SuperTrunfoWeb-2026-08-15/EXPERIENCE.md`, Arquitetura de Informação — "Criar Sala"): a versão original deste FR só previa preenchimento dinâmico; o controle explícito do host sobre a quantidade de IA foi uma decisão de UX incorporada aqui.

#### FR-23: Substituição por IA em Desconexão
Se um Jogador humano perder a conexão durante uma Partida em andamento, o sistema atribui o assento dele a uma IA, que assume o Monte e o estado exatamente de onde ele parou.
**Consequências (testáveis):**
- A Partida continua sem interrupção para os demais Jogadores quando um humano desconecta.
- O Monte do Jogador desconectado não é perdido nem reiniciado — a IA continua a partir do estado exato em que ele estava.

**Notas:** `[NOTE FOR PM]` Capability nova, incorporada a partir da UX (ver EXPERIENCE.md, Padrões de Estado — "Conexão perdida"). O que acontece se o Jogador original reconectar durante a mesma Partida **não** está resolvido por este FR — ver Questão em Aberto §8.6.

#### FR-6: Embaralhamento
O sistema embaralha as 32 Cartas aleatoriamente antes do início de cada Partida.
**Consequências (testáveis):**
- A ordem das Cartas distribuídas varia entre Partidas (não determinística).

#### FR-7: Distribuição de Cartas
O sistema distribui as 32 Cartas igualmente entre os Jogadores; quando a divisão não é exata (ex: 3 Jogadores), aplica uma regra de sobra pré-definida.
**Consequências (testáveis):**
- Com 4 Jogadores, cada um recebe 8 Cartas.
- Com 2 ou 3 Jogadores, a regra de sobra (descarte ou distribuição adicional) é aplicada de forma consistente e documentada.

#### FR-8: Monte em Fila (FIFO)
Cada Jogador possui um Monte privado em formato de fila FIFO, com apenas a Carta do topo visível/jogável.
**Consequências (testáveis):**
- Um Jogador não consegue ver ou selecionar Cartas além da do topo do próprio Monte.
- Um Jogador não consegue ver as Cartas do Monte de outro Jogador (ver também RNF-3, anti-cheat).

### 4.3 Dinâmica da Rodada (Game Loop)

**Descrição:** O ciclo central da Partida: seleção de Atributo, revelação simultânea, comparação e definição de vencedor (RF03). Realiza UJ-1.

**Requisitos Funcionais:**

#### FR-9: Jogador Inicial
O sistema determina um Jogador inicial para abrir a primeira Rodada de cada Partida.
**Consequências (testáveis):**
- Toda Partida nova tem exatamente um Jogador inicial definido antes da primeira Rodada.

#### FR-10: Seleção de Atributo
O Jogador da vez seleciona um dos Atributos numéricos da própria Carta do topo.
**Consequências (testáveis):**
- O sistema só aceita a seleção de um Atributo presente na Carta do topo do Jogador da vez.
- Jogadores que não são o Jogador da vez não conseguem selecionar o Atributo da Rodada.

#### FR-11: Revelação Simultânea
Após a seleção, o sistema revela simultaneamente o valor do mesmo Atributo nas Cartas do topo de todos os outros Jogadores ativos.
**Consequências (testáveis):**
- Nenhum Jogador vê o valor do Atributo de outro antes da revelação simultânea (ver RNF-3).

#### FR-12: Comparação e Vencedor
O sistema compara os valores revelados e declara vencedor o Jogador com o maior valor — ou o menor, quando o Atributo é inversamente proporcional (o documento técnico dá um único exemplo: Aceleração 0-100 km/h).
**Consequências (testáveis):**
- Para Atributos diretos, maior valor vence.
- Para o Atributo Aceleração 0-100 km/h, menor valor vence.
- `[ASSUMPTION]` O requisito original não define uma lista fechada de quais Atributos são inversos além desse exemplo; este PRD assume que cada Atributo carrega essa propriedade como dado (não hardcoded em lógica), mas não resolve quais outros Atributos, se algum, também são inversos — ver Questão em Aberto §8.4.

#### FR-13: Coleta de Cartas
O vencedor da Rodada coleta todas as Cartas jogadas e as insere no fundo (final) do próprio Monte.
**Consequências (testáveis):**
- Após a Rodada, o Monte do vencedor cresce exatamente pelo número de Cartas jogadas naquela Rodada.
- As Cartas coletadas entram no fundo do Monte (FIFO), não no topo.

#### FR-14: Direito de Escolha na Próxima Rodada
O vencedor da Rodada atual escolhe o Atributo da Rodada seguinte.
**Consequências (testáveis):**
- O Jogador da vez na Rodada seguinte é sempre o vencedor da Rodada anterior (exceto nos cenários de eliminação — ver FR-21).

### 4.4 Regra Especial: Carta Super Trunfo

**Descrição:** O comportamento da Carta Super Trunfo e sua exceção (RF04).

**Requisitos Funcionais:**

#### FR-15: Vitória Automática
Se um Jogador aciona a Carta Super Trunfo, o sistema pula a comparação de Atributos e concede vitória automática da Rodada a esse Jogador — exceto se FR-16 for acionado.
**Consequências (testáveis):**
- Nenhuma comparação de Atributo ocorre na Rodada em que a Carta Super Trunfo é jogada e o FR-16 não é acionado.

#### FR-16: Exceção da Carta Letra A
Se a Carta Super Trunfo for jogada na mesma Rodada em que qualquer oponente possui uma Carta cuja identificação termina em "A" (ex: `1A`, `5A`), a vitória automática é anulada.
**Consequências (testáveis):**
- Presença de qualquer Carta terminada em "A" entre os oponentes na mesma Rodada desativa o FR-15 para essa Rodada.

#### FR-17: Vitória da Carta Letra A
No cenário do FR-16, o Jogador com a Carta de letra "A" é declarado vencedor imediato da Rodada, coletando o Super Trunfo e as demais Cartas jogadas.
**Consequências (testáveis):**
- O Monte do Jogador com a Carta letra "A" recebe todas as Cartas jogadas na Rodada, incluindo a Carta Super Trunfo do oponente que a acionou.
- Se mais de um oponente tiver Carta letra "A" na mesma Rodada, o comportamento não está definido por este PRD — ver Questão em Aberto §8.5.

### 4.5 Resolução de Empates ("O Funil")

**Descrição:** Tratamento de empate no valor do Atributo selecionado (RF05).

**Requisitos Funcionais:**

#### FR-18: Retenção no Funil
Em caso de empate no maior valor do Atributo selecionado, o sistema move todas as Cartas da Rodada atual para um container temporário ("Funil").
**Consequências (testáveis):**
- Nenhuma Carta da Rodada empatada volta para o Monte de qualquer Jogador até o desempate ser resolvido.

#### FR-19: Novo Atributo do Desempate
O Jogador que escolheu o Atributo inicial mantém o direito de escolher um novo Atributo, a partir da própria próxima Carta do topo.
**Consequências (testáveis):**
- O Jogador que abriu a Rodada empatada, e não outro Jogador, escolhe o Atributo da Rodada de desempate.

#### FR-20: Coleta do Desempate
O vencedor da nova Rodada de desempate coleta a nova Carta jogada, as novas Cartas dos adversários, e todas as Cartas que estavam retidas no Funil.
**Consequências (testáveis):**
- O Monte do vencedor do desempate cresce pelo total de Cartas da Rodada de desempate somado às Cartas que estavam no Funil.
- O Funil fica vazio após a coleta.

### 4.6 Fim de Jogo e Eliminação

**Descrição:** Condições de eliminação e término da Partida (RF06).

**Requisitos Funcionais:**

#### FR-21: Eliminação
O sistema elimina da Partida o Jogador cujo Monte chegue a zero Cartas.
**Consequências (testáveis):**
- Um Jogador eliminado não é mais convidado a escolher Atributo nem a ter Cartas reveladas nas Rodadas seguintes.

#### FR-22: Fim de Partida
O sistema encerra a Partida e declara vitória quando um único Jogador centraliza todas as 32 Cartas do Baralho.
**Consequências (testáveis):**
- A Partida é sinalizada como encerrada assim que o Monte de um Jogador atinge 32 Cartas.
- Nenhuma nova Rodada é iniciada após o encerramento da Partida.

### 4.7 FAQ de Regras

**Descrição:** Uma tela de perguntas frequentes com as regras completas do jogo (estrutura do Baralho, game loop, Super Trunfo e sua exceção, Funil de desempate, fim de jogo), acessível a partir da tela inicial/lobby — antes de criar ou entrar numa Sala. Não é exibida em nenhuma superfície da Mesa de Jogo: a Partida em si não ganha tutorial embutido, decisão já tomada na UX (ver `EXPERIENCE.md` → Inspiração & Anti-padrões, "Rejeitado — onboarding/tutorial explícito") — a FAQ é consulta opcional fora da Partida, não um tutorial forçado durante ela.

**Requisitos Funcionais:**

#### FR-24: Acesso às Regras via FAQ
O sistema disponibiliza uma FAQ com as regras completas do jogo, acessível a partir da tela inicial.
**Consequências (testáveis):**
- A FAQ é alcançável a partir da tela inicial/lobby sem precisar criar ou entrar numa Sala.
- A FAQ não aparece em nenhuma superfície da Mesa de Jogo (Partida em andamento).

**Notas:** `[NOTE FOR PM]` Requisito novo, pedido pelo usuário após a UX já estar com status `final` — a superfície da FAQ ainda **não** está refletida em `EXPERIENCE.md` (Arquitetura de Informação) nem em `DESIGN.md`; é o próximo passo, a cargo de uma atualização da UX.

## 5. Não-Metas (Explícitas)

- Não vamos suportar outros temas de Baralho além de carros nesta fase.
- Não vamos implementar contas de Jogador persistentes, histórico entre Partidas ou ranking.
- Não vamos oferecer matchmaking com Jogadores desconhecidos — o uso previsto é entre pessoas que já se conhecem.
- Não vamos implementar nenhum modelo de monetização.
- Não vamos resolver o licenciamento formal da marca "Super Trunfo" nesta fase (ver §8.2) — aceitável para uso pessoal/privado, não para lançamento público.
- Não vamos construir um app nativo mobile — só web responsivo.

## 6. Escopo do MVP

### 6.1 Dentro do Escopo
- Baralho único, temático de carros, conforme §4.1-§4.6 (FR-1 a FR-22)
- Partidas de 2 a 4 Jogadores, com IA preenchendo vagas (na criação da sala e dinamicamente) e substituindo Jogadores desconectados (FR-5, FR-23)
- FAQ de regras acessível na tela inicial (FR-24)
- Multiplayer em tempo real via WebSocket
- Anti-cheat de estado (Monte protegido — ver RNF-3)
- Interface responsiva (mobile e desktop)

### 6.2 Fora de Escopo para o MVP
- Outros temas de Baralho — deferido indefinidamente, sem data
- Contas persistentes / histórico / ranking — deferido, revisitar só se o projeto virar produto
- Matchmaking com desconhecidos — não planejado
- Monetização — não planejado
- `[NOTE FOR PM]` Resolução do licenciamento de marca — carregado emocionalmente pela decisão de manter o nome "Super Trunfo": revisitar se o projeto sair do círculo pessoal (ver brief, §Riscos).

## 7. Métricas de Sucesso

Projeto hobby — métricas propositalmente leves, herdadas do brief.

**Primária**
- **SM-1**: Uma Partida completa roda do início ao fim (embaralhar → 32 Cartas com um vencedor) sem travar ou exigir intervenção manual. Valida FR-1 a FR-22.

**Secundária**
- **SM-2**: Família e amigos jogam partidas de verdade — e topam repetir. Valida UJ-1, UJ-2 (o jogo é divertido o suficiente para as pessoas quererem voltar).
- **SM-3**: O processo de construção entrega o aprendizado técnico buscado (arquitetura em tempo real, WebSocket, lógica de estado de jogo) — critério qualitativo, autoavaliado pelo criador, herdado diretamente do brief (§Critérios de Sucesso).

**Contra-métrica (não otimizar)**
- **SM-C1**: Não investir em infraestrutura para escalar além de algumas Partidas simultâneas entre conhecidos — isso está fora do JTBD desta fase e distrai do objetivo de aprendizado. Contrabalança qualquer tentação de tratar RNF-2 (escalabilidade) como "suportar milhares de usuários" em vez de "funcionar bem para o círculo de uso real".

## Requisitos Não-Funcionais Transversais

*(Herdados de `docs/requisitos_super_trunfo.md`, RNF01-RNF04 — reafirmados aqui porque cruzam todas as Funcionalidades acima.)*

- **RNF-1 (Desempenho):** transições de Rodada, comparações de valores e animações de Carta não devem exceder 1,5s de processamento no servidor.
- **RNF-2 (Escalabilidade):** o backend deve suportar conexões WebSocket simultâneas para manter o estado da Partida em tempo real entre múltiplos Jogadores. `[NOTE FOR PM]` Adição deste PRD (não está no requisito original): dimensionar para o uso real do hobby (família/amigos, poucas Partidas simultâneas), não para escala pública — ver contra-métrica SM-C1. Revisitar se o projeto virar produto.
- **RNF-3 (Segurança / Anti-cheat):** o estado do Monte de cada Jogador deve ser protegido — nenhum cliente pode inspecionar as Cartas do fundo do Monte via console/API antes da hora. Aplica-se diretamente a FR-8 e FR-11.
- **RNF-4 (Responsividade):** a interface web deve funcionar perfeitamente em dispositivos móveis e desktops.

## 8. Questões em Aberto

1. **Qual Carta recebe a flag Super Trunfo** — `docs/carros_specs.csv` já tem a coluna `SuperTrunfo`, mas todas as 32 Cartas estão como `false`. O usuário decidirá qual Carta marcar mais tarde (FR-3); até lá, o Baralho é tecnicamente incompleto para uma Partida real.
2. **Licenciamento da marca "Super Trunfo"** — decisão consciente do usuário de adiar (ver brief, §Riscos). Registrado aqui para não se perder na transição a Arquitetura/Épicos.
3. **Regra de sobra na distribuição (FR-7)** — o requisito técnico original menciona "descartadas ou distribuídas sob regra pré-definida" sem especificar qual. `[ASSUMPTION]` Este PRD não resolve qual regra — fica para a Arquitetura ou para uma decisão de implementação, já que não muda o comportamento observável para o caso mais comum (4 Jogadores, divisão exata).
4. **Lista de Atributos inversos (FR-12)** — o requisito original dá um único exemplo (Aceleração 0-100 km/h) sem definir uma lista fechada. `[ASSUMPTION]` Assumido que cada Atributo carrega essa propriedade como dado, mas quais Atributos (além do exemplo) são inversos não foi resolvido aqui — fica para Arquitetura decidir a modelagem, possivelmente em conversa com o usuário sobre os demais Atributos do CSV (Velocidade Máxima, Potência, RPM, Cilindrada, Qtd. Cilindros — todos plausivelmente diretos, mas não confirmados).
5. **Empate na exceção da carta letra "A" (FR-17)** — como cada um dos 8 Grupos tem uma Carta terminada em "A", é matematicamente possível que dois ou mais oponentes diferentes tenham uma Carta letra "A" como topo do próprio Monte na mesma Rodada em que o Super Trunfo é jogado. O requisito técnico original não cobre esse caso, e este PRD não o resolve — fica para Arquitetura/Épicos definir um critério de desempate (ex: ordem de turno, Grupo menor primeiro, etc.).
6. **Reconexão após desconexão (FR-23)** — a UX propôs, sem confirmação do usuário, que o controle do assento volte ao Jogador humano só no início da próxima Rodada (nunca no meio de uma em andamento). Este PRD registra a proposta mas não a confirma como requisito — fica para o usuário decidir ou para a Arquitetura assumir como padrão de implementação.
7. **Superfície da FAQ ainda não desenhada** — FR-24 é requisito novo; `EXPERIENCE.md`/`DESIGN.md` (status `final`) ainda não cobrem essa tela. Precisa de uma atualização da UX antes da Arquitetura tratar isso como pronto para implementar.

## 9. Índice de Suposições

- `[ASSUMPTION]` §2.2: público secundário nostálgico (30-44 anos) herdado do brief, não endereçado ativamente nesta fase.
- `[ASSUMPTION]` §8.3: a regra de sobra na distribuição de cartas (FR-7, caso não-exato) fica para decisão de implementação/arquitetura, não bloqueia este PRD.
- `[ASSUMPTION]` §4.3 (FR-12) / §8.4: quais Atributos (além de Aceleração 0-100 km/h) são inversamente proporcionais não foi confirmado com o usuário.
- `[ASSUMPTION]` §8.6: a regra de reconexão (retomar assento só no início da próxima Rodada) veio da UX, não foi confirmada pelo usuário neste PRD.
