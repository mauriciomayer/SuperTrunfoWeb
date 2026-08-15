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
