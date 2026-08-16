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
