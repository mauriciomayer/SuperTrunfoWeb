# Deferred Work

<!-- Append-only. Do not modify or delete existing entries. -->

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffolding-do-projeto.md`
  summary: Backend não faz shutdown gracioso (SIGTERM/SIGINT) para descartar Rooms de forma limpa.
  evidence: Fora de escopo da Story 1.1 (sem infra de produção nesta história), mas vai importar quando a Story 1.5 (Publicar o Jogo) fizer deploy/restart real.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffolding-do-projeto.md`
  summary: A porta do backend (2567) está duplicada como literal em `backend/src/index.ts`, `playwright.config.ts` e `frontend/src/client/colyseusClient.ts`, sem fonte única.
  evidence: Não dá pra compartilhar uma constante entre frontend/backend sem violar AD-10 (sem import cruzado); precisa de solução via variável de ambiente numa história futura (provavelmente 1.5).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffolding-do-projeto.md`
  summary: `backend/` não tem script de lint (frontend tem `oxlint`) e nenhum dos dois está plugado num pipeline de CI.
  evidence: Proporcional pra escopo hobby por enquanto, mas vale decidir se o projeto crescer.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffolding-do-projeto.md`
  summary: `PartidaRoom.onLeave` não usa nem testa o parâmetro `consented` (saída limpa vs. desconexão abrupta).
  evidence: Vai importar no Épico 3, quando a saída abrupta precisa disparar o takeover de IA (AD-9) -- distinguir de uma saída intencional do jogador.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-criar-sala.md`
  summary: `PartidaRoom.onLeave` não remove o `Jogador` correspondente de `EstadoPartida.jogadores` -- quem sai fica como entrada fantasma pra sempre.
  evidence: Atualização da lista quando alguém entra/sai é explicitamente escopo da Story 1.4 (Boundaries do spec 1.2), mas a limpeza de estado em si é pré-requisito pra 1.4 construir em cima corretamente.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-criar-sala.md`
  summary: `SalaDeEspera` não trata `room.onLeave`/`room.onError` -- se a conexão cair enquanto o host espera, a tela continua mostrando o último estado conhecido sem nenhum aviso.
  evidence: Conecta com a decisão maior de "sem reconexão" (AD-9); melhor decidir junto com o trabalho de takeover de IA do Épico 3 do que isoladamente aqui.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-criar-sala.md`
  summary: Não existe forma de cancelar/sair da Sala de Espera de volta pra Criar Sala se o host errou a configuração.
  evidence: Escopo novo, não exigido por nenhum FR/AC desta história; vale considerar quando a Story 1.4 construir a Sala de Espera completa.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-criar-sala.md`
  summary: Recarregar a página na Sala de Espera perde a referência ao `room` (sem `roomId` persistido/reconexão), abandonando a sala recém-criada.
  evidence: Mesmo território da decisão deliberada de "sem reconexão" (AD-9) pro projeto inteiro; só vale revisitar se AD-9 for revisitada.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-entrar-na-sala.md`
  summary: `entrarSala()`/`criarSala()` não têm timeout -- se a chamada de rede travar, o botão fica preso em "Entrando…"/"Criando…" pra sempre, sem forma de tentar de novo.
  evidence: Afeta as duas telas de entrada (Criar Sala e Entrar na Sala) igualmente; vale uma solução única em vez de duas correções ad-hoc.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-entrar-na-sala.md`
  summary: O campo de nome não tem limite de tamanho no cliente, e o servidor (`PartidaRoom.onJoin`) também não limita -- agora afeta host e convidado.
  evidence: Gap herdado da Story 1.2, agora presente em duas telas; melhor resolver uma vez só, de forma consolidada, do que corrigir cada tela isoladamente.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-entrar-na-sala.md`
  summary: Sem distinção visual entre dois Jogadores com o mesmo nome de exibição (ex: dois "Rafael" na mesma Partida) -- `sessionId` distingue por baixo dos panos, mas a lista não mostra isso.
  evidence: Plausível numa Partida em família; nenhum FR/UX exige tratamento disso hoje, mas vale reconsiderar se aparecer na prática.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-sala-de-espera.md`
  summary: `.btn-primario` está duplicado (mesmo bloco CSS) em `CriarSala.css`, `EntrarSala.css` e agora `SalaDeEspera.css`, cada um escopado por tela pra evitar colisão de cascata.
  evidence: Consolidar num componente/classe compartilhada tocaria as três telas de uma vez, fora do escopo desta história (Boundaries não permite mexer em `CriarSala`/`EntrarSala`); vale uma passada única quando fizer sentido tocar as três juntas.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-sala-de-espera.md`
  summary: Quando o handler real de `iniciarPartida` for escrito no backend (Épico 2), ele precisa validar de novo que quem mandou é o host -- hoje o gate é só client-side (o botão some da UI, mas `room.send("iniciarPartida")` não é bloqueado por ninguém).
  evidence: Inofensivo agora porque não existe handler nenhum ainda; a regra "só do host" já está documentada na tabela de mensagens da AD-1, então isso é mais um lembrete do que um gap novo.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-publicar-o-jogo.md`
  summary: `DEPLOY.md` não avisa que, no plano gratuito do Render, a instância "dormir" por inatividade durante uma Partida em andamento derruba as conexões WebSocket abertas e o estado em memória da Sala/Partida -- só o atraso de acordar no acesso inicial está documentado, não a perda de estado no meio do jogo.
  evidence: Baixa prioridade -- pra uma sessão familiar de uso concentrado, a instância dificilmente dorme no meio de uma Partida ativa; vale só se o plano gratuito continuar sendo usado depois de uso real.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-baralho-distribuicao-e-minha-carta.md`
  summary: `PartidaRoom.onLeave` agora tem uma Mão de verdade (Monte distribuído) pra destruir se alguém sai depois de `iniciarPartida` -- some do `state.jogadores` sem reatribuir host nem limpar `jogadorDaVez` se for quem saiu era o Jogador da vez.
  evidence: Território do takeover de IA por desconexão (AD-9, Épico 3) -- implementar isso agora seria antecipar escopo do Épico 3 dentro do Épico 2; melhor resolver os dois juntos quando o Épico 3 chegar.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-baralho-distribuicao-e-minha-carta.md`
  summary: O padrão "forçar re-render via `useState(0)` + `room.onStateChange`" está duplicado em `SalaDeEspera.tsx`, `MesaDeJogo.tsx` e `App.tsx` -- cada tela reinstala o próprio listener em vez de compartilhar um hook.
  evidence: Consolidar num hook (`useRoomState(room)`) tocaria `SalaDeEspera.tsx`, fora do escopo desta história (Boundaries proíbem mexer nela aqui); vale uma passada única quando fizer sentido tocar as três telas juntas.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-comparacao-vencedor-e-proxima-rodada.md`
  summary: Um Jogador (principalmente o vencedor) se desconectando durante os 2,5s de `Revelando` é uma instância nova e mais severa do gap de desconexão em partida já rastreado (perda de Cartas + `jogadorDaVez` travado, não só "entrada fantasma") -- esta história só blindou contra o crash/corrupção, sem implementar o comportamento correto de jogo pra esse caso.
  evidence: Território do takeover de IA por desconexão (AD-9, Épico 3), mesma razão dos itens já registrados nas Stories 2.1/1.2 -- decidir o comportamento "certo" (o que acontece com as Cartas/vez de um vencedor desconectado) é decisão de design de jogo, não só código, melhor resolvida junto com o resto do Épico 3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-comparacao-vencedor-e-proxima-rodada.md`
  summary: O teste E2E de resolução de Rodada escolhe um Atributo com baixa probabilidade de empate (~0,6% no baralho real) em vez de forçar um resultado determinístico -- um empate real faria esse teste falhar por timeout confuso em vez de um sinal claro.
  evidence: Forçar determinismo exigiria um hook de teste só pra isso no código de produção do servidor (os testes de integração conseguem mockar `embaralhar` porque rodam a Room em processo; o E2E sobe um servidor real separado) -- risco residual aceito, baixa prioridade pra um projeto hobby.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-carta-super-trunfo.md`
  summary: Nenhum teste E2E (Playwright) cobre o fluxo de Super Trunfo -- a Verification do spec pedia estender `e2e/mesa-de-jogo.spec.ts` forçando a `2A` no topo de alguém, mas isso exigiria um hook de teste dedicado no servidor real (mesmo gap já registrado pra Story 2.3: os testes de integração conseguem mockar `embaralhar` via `vi.mock` porque rodam a Room em processo; o E2E sobe um servidor Colyseus real separado via `npm run dev`, sem esse hook). Sem forçar a Super Trunfo pro topo, esperar ela surgir organicamente numa Partida de 32 Cartas embaralhadas tornaria o teste lento e flaky.
  evidence: Cobertura unitária (`superTrunfo.test.ts`, sem-oposição/uma-Carta-A/múltiplas-Cartas-A-circular-com-wraparound) e de integração de Room (`PartidaRoom.integration.test.ts`, fluxo completo com `embaralharOverride`, incluindo visibilidade via StateView de cliente real) cobrem toda a Matrix e a máquina de estados -- risco residual aceito, mesma classe de gap já documentado pra Story 2.3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-carta-super-trunfo.md`
  summary: Vagas de IA (`Jogador.isIA`) têm `sessionId` sempre `""` (nenhum `Client` de rede associado). Se uma IA vencer qualquer Rodada -- fluxo normal de Atributo (Story 2.2/2.3) ou Super Trunfo (Story 2.4), o defeito é o mesmo raiz e pré-existe esta história -- `rodadaAtual.jogadorDaVez` vira `""`, e nenhum `client.sessionId` de verdade jamais bate com isso (`aoReceberJogarCarta` rejeita silenciosamente pra sempre). A Partida trava permanentemente, sem nenhuma Carta jogável por ninguém.
  evidence: Território do takeover/comportamento de IA (AD-9, Épico 3) -- não existe hoje nenhuma lógica de "vez da IA" (auto-jogar, passar a vez), então mesmo corrigindo a colisão de `sessionId` entre IAs (ver achado do Story 2.4 sobre múltiplas IAs recebendo o destaque `destacada` simultaneamente, corrigido via índice em vez de `sessionId`), o jogo travaria do mesmo jeito quando a vez chegasse numa IA -- resolver isso de verdade é decisão de design de jogo (o que uma IA "joga"?), melhor decidida junto com o resto do Épico 3. Achado pela revisão de edge-case da Story 2.4; risco real e já alcançável em jogo normal com IA desde a Story 2.2/2.3 (não é exclusivo do Super Trunfo), não só uma preocupação hipotética de Épico 3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-funil-desempate.md`
  summary: Nenhum teste E2E (Playwright) cobre o fluxo de Funil/desempate -- a Verification do spec já aceita esse gap explicitamente ("cenário de Funil forçado NÃO estendido, mesmo gap de determinismo já aceito nas Stories 2.3/2.4"). Forçar um empate real exigiria o mesmo hook de teste dedicado no servidor real que as Stories 2.3/2.4 já não têm (o E2E sobe um servidor Colyseus real via `npm run dev`, sem forma de mockar `embaralhar` como os testes de integração de Room fazem via `vi.mock`); esperar um empate surgir organicamente (~0,6% de chance por Rodada, mesma estimativa da Story 2.3) tornaria o teste lento e flaky.
  evidence: Cobertura de integração de Room (`PartidaRoom.integration.test.ts`, Matrix inteira -- empate simples, nova Rodada sem empate após o Funil, empates consecutivos -- via `embaralharOverride`, incluindo verificação client-decodificada de que `cartasPresas` nunca vaza StateView) cobre a máquina de estados inteira -- risco residual aceito, mesma classe de gap já documentada pras Stories 2.3/2.4.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-funil-desempate.md`
  summary: Se o Jogador que abriu a Rodada empatada (`rodadaAtual.jogadorDaVez`) desconectar durante a pausa de "Revelando" e os Jogadores restantes empatarem entre si nessa mesma Rodada, `resolverRodada` preserva `jogadorDaVez` sem revalidar que essa sessão ainda existe em `state.jogadores` -- ao contrário do caminho vencedor (que já revalida `vencedor` antes de mover Cartas, achado da Story 2.3). `jogadorDaVez` fica apontando pra uma sessão fantasma, travando a Partida pra sempre (nenhum Client real bate com esse sessionId).
  evidence: Território do takeover/desconexão de IA (AD-9, Épico 3), mesma classe de gap já documentada nas Stories 2.1/2.3/2.4 -- antes desta história, QUALQUER empate já travava a Partida incondicionalmente (estado parava em "Funil" pra sempre), então esse cenário especifico de desconexão não conseguia causar dano adicional; agora que empates resolvem e o jogo continua, esse gatilho estreito (abridor da Rodada desconecta durante a pausa E os sobreviventes empatam entre si) passa a ser alcançável de verdade. Achado pela revisão de edge-case da Story 2.5; risco residual aceito, decisão de comportamento "certo" pra sessão fantasma é design de jogo do Épico 3, não só código.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-funil-desempate.md`
  summary: `EXPERIENCE.md` descreve o estado "Empate → Funil" como Cartas "visualmente movidas para o componente Funil" -- a implementação não tem nenhuma animação (as Cartas reveladas simplesmente somem da área de revelação e a tray `Funil.tsx` aparece com a contagem nova, sem transição visual nenhuma ligando "essas Cartas especificas" ao Funil).
  evidence: A spec desta história (aprovada) só pediu a tray com contagem, sem animação -- mesma proporcionalidade de outras simplificações já feitas neste projeto hobby (ex: sem faixa de cabeçalho na Carta, Story 2.1). Vale reconsiderar se/quando o projeto investir em polish visual geral (Cartas "voando" pro Monte do vencedor, já mencionado em `epic-2-context.md` mas também não implementado em nenhuma história do Épico 2 até agora).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-fim-de-jogo-e-eliminacao.md`
  summary: Nenhum teste E2E (Playwright) cobre o fluxo de Fim de Partida -- a Verification do spec já aceita esse gap explicitamente ("cenário de Fim de Partida forçado NÃO estendido, mesmo gap de determinismo já aceito nas Stories 2.3/2.4/2.5"). Jogar até alguém reunir o Baralho inteiro organicamente levaria dezenas de Rodadas (lento e flaky); forçar isso exigiria o mesmo hook de teste dedicado no servidor real que as Stories 2.3/2.4/2.5 já não têm (o E2E sobe um servidor Colyseus real via `npm run dev`, sem forma de mockar `embaralhar`/truncar Montes como os testes de integração de Room fazem).
  evidence: Cobertura de integração de Room (`PartidaRoom.integration.test.ts`, Matrix inteira -- eliminação simples, Fim de Partida por coleta, Fim de Partida por atrito, vez pulando o Jogador recém-eliminado, caso degenerado sem crash -- via `embaralharOverride` + truncamento direto de `monte` em `room.state`) e de componente (`FimDePartida.test.tsx`/`MesaDeJogo.test.tsx`, Chip "Eliminado" e Banner de Vitória) cobrem a máquina de estados e a UI inteiras -- risco residual aceito, mesma classe de gap já documentada pras Stories 2.3/2.4/2.5.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-fim-de-jogo-e-eliminacao.md`
  summary: O caso totalmente degenerado de `ativos.length === 0` (um empate elimina simultaneamente TODOS os Jogadores que jogaram, ninguém sobra ativo na Partida inteira) não tem nenhum comportamento de jogo "correto" implementado -- `resolverRodada` apenas loga um `warn` e aborta a resolução inteira ANTES de mover qualquer Carta, deixando `estado` congelado em "Revelando"/"SuperTrunfoAcionado" pra sempre (sem nenhum Client conseguir mandar `jogarCarta` dali em diante, já que não é mais a vez de ninguém em `AguardandoSelecao`).
  evidence: Boundaries "Never" do spec desta história marca esse caso explicitamente como decisão de design de jogo futura, não desta história ("Resolver esse empate/vitória-nenhuma de verdade é decisão de design de jogo futura, não desta história"). Coberto por teste de integração de Room (não crasha, não muda `estado`/Cartas, loga `warn`) -- risco residual aceito, comportamento "correto" fica em aberto pra quando o projeto decidir como tratar esse desfecho (ex: empate declarado, revanche automática, etc.).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-fim-de-jogo-e-eliminacao.md`
  summary: `EXPERIENCE.md` ("Banner de Vitória") e o mockup aprovado (`key-fim-partida.html`) descrevem confete, um emoji de troféu, e a linha do vencedor destacada em negrito na lista de Jogadores -- nada disso foi implementado em `FimDePartida.tsx`/`.css`; a linha do vencedor renderiza com o mesmo estilo de qualquer Jogador eliminado.
  evidence: A spec desta história (aprovada) só pediu o Banner de Resultado (texto) + lista + botão "Jogar Novamente", sem especificar confete/troféu/negrito -- mesma proporcionalidade de simplificações visuais já aceitas no projeto (ex: sem animação de Cartas "voando" pro Funil, Story 2.5). Achado da revisão blind-hunter; vale reconsiderar junto com qualquer investimento futuro em polish visual geral do Épico 2.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-fim-de-jogo-e-eliminacao.md`
  summary: `PartidaRoom.resolverRodada` (branch de empate) acha `jogadorDaVezAtual` comparando `sessionId` (`state.jogadores.find(j => j.sessionId === rodadaAtual.jogadorDaVez)`) -- mesma fragilidade já documentada da Story 2.4 (assentos de IA compartilham `sessionId === ""`, `find`/`findIndex` por `sessionId` pode resolver o assento errado com 2+ IAs). `game/turno.ts` (`proximoJogadorAtivo`) tem a mesma fragilidade internamente.
  evidence: Não é alcançável de verdade hoje: `rodadaAtual.jogadorDaVez` só chega a `""` (sessionId de IA) se uma IA já tiver vencido uma Rodada anterior -- cenário que já trava a Partida permanentemente por um motivo anterior e mais básico (nenhum Client real com sessionId "" consegue mandar `jogarCarta`, achado já registrado nas Stories 2.4/2.5). Corrigir isso aqui isoladamente (comparar por índice em vez de sessionId) não desbloquearia nada sozinho -- é território de "IA jogando de fato" do Épico 3. Achado pela revisão de edge-case da Story 2.6; registrado por completude, mesma classe dos achados já documentados.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-selecao-de-atributo-e-revelacao.md`
  summary: O teste "Matrix: atributo ausente (jogarCarta({})) -- rejeitado, nada muda" em `PartidaRoom.integration.test.ts` (helper `criarPartidaEmAguardandoSelecao`) não força a ordem do Baralho -- se o topo real (embaralhado de verdade) do host calhar de ser a Super Trunfo (`2A`, ~1/32 de chance por execução), `jogarCarta({})` deixa de ser rejeitado (Story 2.4 tornou `atributo` opcional pra essa Carta) e o teste falha esperando `AguardandoSelecao` mas recebendo `SuperTrunfoAcionado`.
  evidence: Achado ao rodar a suite de integração durante a verificação independente da Story 2.6 (falha real, não o flake de rede `MatchMakeError: fetch failed` já documentado à parte) -- reproduzido uma vez, confirmado transiente/raro numa nova execução limpa (38/38). Pré-existente desde que a Story 2.4 introduziu a exceção da Super Trunfo; nunca antes registrado. Correção trivial (forçar uma Carta não-Super-Trunfo no topo do host via `embaralharOverride`, mesmo padrão já usado em outros testes desta suite) mas fora do escopo da Story 2.6, que não tocou este teste.
