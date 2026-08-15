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
