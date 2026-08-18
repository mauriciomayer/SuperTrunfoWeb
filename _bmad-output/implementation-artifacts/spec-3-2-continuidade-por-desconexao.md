---
title: 'Continuidade por Desconexão'
type: 'feature'
created: '2026-08-16'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
baseline_commit: '98f6d601644201c95777b415f431c323a9764c24'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `PartidaRoom.onLeave` (Story 1.4) remove o `Jogador` de `state.jogadores` incondicionalmente -- correto na Sala de Espera (sem Monte nem estado de jogo pra preservar), mas destrutivo demais numa Partida já em andamento: perderia o Monte de quem saiu, quebraria `jogadorDaVez` apontando pra uma sessão inexistente, e desalinharia os índices que `turno.ts`/`superTrunfo.ts` dependem (ordem de entrada, AD-8). Hoje, se um Jogador humano cai no meio de uma Partida, ela trava.

**Approach:** `onLeave` passa a diferenciar as duas fases: na Sala de Espera (`estado === "AguardandoJogadores"`), comportamento inalterado (remove). Numa Partida já em andamento, o `Jogador` NUNCA é removido -- vira `isIA = true` NO LUGAR, preservando Monte/posição/nome exatamente como estavam ("continua de onde parou"). Se a desconexão aconteceu bem na hora da própria vez dele (`estado === "AguardandoSelecao"` e `rodadaAtual.jogadorDaVez` é a sessão que saiu), a jogada automática dispara IMEDIATAMENTE via `despacharJogadaDeIA` (Story 3.1, reaproveitado sem mudança) -- sem isso a Rodada ficaria esperando pra sempre por um `jogarCarta` que nunca chegaria. Se a desconexão aconteceu durante a pausa de revelação (já jogou nesta Rodada), nada precisa disparar agora -- `resolverRodada` (Stories 2.3+) já encontra o `Jogador` normalmente (nunca mais some de `state.jogadores`) quando a pausa terminar. A troca é permanente -- `this.lock()` (já chamado desde a Story 2.1, logo após `iniciarPartida`) já impede qualquer `joinById` novo numa Partida em andamento, então o Jogador original nunca reconsegue o assento de volta, sem precisar de nenhuma lógica nova.

## Boundaries & Constraints

**Always:**
- `PartidaRoom.onLeave`: se `this.state.estado === "AguardandoJogadores"`, comportamento da Story 1.4 inalterado (remove de `state.jogadores`). Senão (Partida em andamento, qualquer outro `estado`): NUNCA remove -- só seta `isIA = true` no `Jogador` já existente (mesma posição, mesmo `sessionId` antigo -- inerte pra sempre, nunca mais bate com nenhum Client real -- mesmo Monte, mesmo `nome`).
- Nesse mesmo branch, se `this.state.estado === "AguardandoSelecao"` E `this.state.rodadaAtual.jogadorDaVez === client.sessionId` (era a vez dele agora, ainda não tinha jogado nesta Rodada): dispara `this.despacharJogadaDeIA(jogador)` (Story 3.1) imediatamente, mesmo objeto `Jogador` já resolvido -- nunca um novo lookup por `sessionId`.

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução.

**Never:**
- Reatribuição de host -- `isHost` não é lido em nenhum lugar depois que a Partida começa (só na Sala de Espera), então a desconexão do próprio host durante uma Partida em andamento não precisa de tratamento especial nenhum.
- Qualquer mecanismo de reconexão/UI de "reconectar" -- decisão já fechada (AD-9); `this.lock()` já bloqueia estruturalmente o retorno, sem precisar de lógica nova aqui.
- O ciclo de vida da Room quando TODOS os Jogadores humanos saem (só IA restando) -- `autoDispose` padrão do Colyseus, território já documentado em `deferred-work.md` (Story 3.1); sem "demais" humanos pra proteger, não é problema desta história.
- Qualquer mudança de frontend -- a Mesa de Jogo já mostra IA genericamente (Story 3.1); um assento que "virou" IA no meio da Partida não é visualmente diferente de um que já era IA desde o início.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Desconexão fora da própria vez | Jogador humano desconecta, não é `jogadorDaVez` agora | Assento vira IA, Partida continua sem interrupção pros demais; a próxima vez que for a vez dele, joga automaticamente | N/A |
| Desconexão na própria vez | Jogador humano desconecta com `estado === "AguardandoSelecao"` e `jogadorDaVez` é ele | Assento vira IA E a jogada dispara imediatamente -- Rodada não fica travada esperando | N/A |
| Desconexão durante a pausa de revelação | Jogador humano desconecta com `estado` em `"Revelando"`/`"SuperTrunfoAcionado"` (já jogou nesta Rodada) | Assento vira IA; `resolverRodada` resolve normalmente quando a pausa terminar, usando a Carta já jogada | N/A |
| Jogador original tenta voltar | Reabre o link de convite pra uma Partida já em andamento (assento já é IA) | `joinById` rejeitado (`this.lock()` já ativo desde `iniciarPartida`) -- nunca retoma o assento | Erro de sala bloqueada, mesmo comportamento já existente de sala cheia/trancada |
| Desconexão na Sala de Espera (regressão) | Jogador humano desconecta ANTES de `iniciarPartida` (`estado === "AguardandoJogadores"`) | Comportamento da Story 1.4 inalterado -- removido de `state.jogadores`, nunca vira IA | N/A |

</frozen-after-approval>

## Code Map

- `backend/src/rooms/PartidaRoom.ts`, `onLeave` (linha ~1085) -- bifurca por `estado`; fora da Sala de Espera, converte pra IA em vez de remover, e dispara `despacharJogadaDeIA` se era a vez dele agora

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/rooms/PartidaRoom.ts` -- `onLeave` bifurcado (Sala de Espera inalterada; Partida em andamento converte pra IA + dispara jogada se era a vez) -- efetiva toda a Matrix
- [x] Teste de integração de Room -- Matrix inteira via `@colyseus/testing`: desconexão fora da vez, na própria vez (dispara automático), durante a pausa de revelação, tentativa de retorno rejeitada (`joinById` numa sala já trancada), e a regressão da Sala de Espera (Story 1.4, ainda remove)
- [x] (achado durante a implementação, fora do Code Map original) Teste de integração pré-existente da Story 2.3 ("Boundaries defensivo: o Jogador que teria vencido desconecta durante Revelando") testava a premissa antiga de `onLeave` (remoção incondicional) e passou a falhar -- atualizado pra provar o caminho feliz novo (assento vira IA, `resolverRodada` credita a vitória normalmente) em vez do abort defensivo obsoleto
- [x] (achado da revisão -- verification-gap) a Matrix cobre "Revelando"/"SuperTrunfoAcionado" na mesma linha, mas só o caminho "Revelando" tinha teste; adicionado teste dedicado pra desconexão do próprio Jogador do Super Trunfo durante "SuperTrunfoAcionado" (`indiceDoSuperTrunfo` nunca fica -1), e o comentário do guard defensivo correspondente em `resolverRodada` (`PartidaRoom.ts:607-621`) atualizado pra registrar que ele agora é estruturalmente inalcançável via desconexão
- [x] (achado da revisão -- blind-hunter) `MesaDeJogo.tsx:275` usava `key={oponente.isIA ? \`ia-${indice}\` : oponente.sessionId}` -- quando um assento humano vira IA no meio da Partida (exatamente o cenário desta história), a key trocava de `sessionId` estável pra um índice, remontando o nó DOM do oponente sem necessidade. Simplificado pra `key={oponente.sessionId}` (estável e único desde a Story 3.1 pra qualquer assento, humano ou IA)

**Acceptance Criteria:**
- Given uma Partida em andamento, when um Jogador humano perde a conexão, then o sistema atribui o assento dele a uma IA que assume o Monte e o estado exatamente de onde ele parou, e a Partida continua sem interrupção pros demais
- Given o assento foi assumido pela IA, when o Jogador original reabre o link, mesmo dentro da mesma Partida, then ele não retoma o assento em nenhuma circunstância

## Design Notes

Converter em vez de remover também fecha, de graça, um risco residual documentado nas Stories 2.3/2.5/2.6 ("vencedor desconectou durante a pausa de revelação, achado defensivo -- Cartas nunca movidas, mas o comportamento 'certo' era decisão futura do Épico 3"): como o `Jogador` nunca mais some de `state.jogadores` numa Partida em andamento, `resolverRodada` sempre encontra quem precisa encontrar, mesmo que a sessão real já tenha caído -- os `if (!vencedor) return` defensivos continuam aí (nunca fazem mal), mas essa classe específica de desconexão-durante-a-pausa deixa de ser alcançável.

**Correção pós-aprovação (revisão):** a premissa do Boundaries "Never" de que nenhuma mudança de frontend seria necessária ("um assento que 'virou' IA no meio da Partida não é visualmente diferente de um que já era IA desde o início") ficou tecnicamente incompleta -- verdadeira pro *conteúdo* renderizado, mas não pra *identity* React do nó DOM: a key usada em `MesaDeJogo.tsx` distinguia oponentes IA de oponentes humanos, então a conversão mid-partida trocava a key do oponente afetado e forçava um remount desnecessário exatamente no momento da desconexão. Ver achado de revisão nas Tasks acima -- corrigido com uma mudança de 1 linha (key sempre `sessionId`), sem contradizer o espírito do Boundaries (nenhuma mudança de comportamento/UI visível foi necessária, só a key interna do React).

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd backend && npm test` -- 65/65 verde
- `cd backend && npm run test:integration` -- 48/48 verde (inclui a Matrix inteira de desconexão/continuidade, incluindo o cenário "SuperTrunfoAcionado" adicionado na revisão). Uma reexecução isolada bateu no flake ambiental já documentado em histórias anteriores desta sessão (`Matrix: jogarCarta fora de AguardandoSelecao`, Story 2.2, embaralhamento real sem override ocasionalmente sorteia Super Trunfo no topo) -- confirmado não-relacionado a esta história via 3 reexecuções isoladas limpas, todas verdes
- `cd frontend && npm test` -- 98/98 verde (a mudança de key em `MesaDeJogo.tsx` foi a única mudança de frontend desta história, e é coberta pelos testes de componente existentes)
- `npx playwright test` -- 9/9 verde

**Manual checks (if no CLI):**
- Iniciar uma Partida com 2 humanos, fechar a aba de um deles no meio de uma Rodada (na própria vez dele) e confirmar que a Rodada resolve sozinha, sem travar pro Jogador que ficou.

## Suggested Review Order

1. [PartidaRoom.ts:1085](../../backend/src/rooms/PartidaRoom.ts#L1085) -- `onLeave` bifurcado: Sala de Espera inalterada, Partida em andamento converte pra IA + dispara jogada imediata se era a vez do desconectado
2. [PartidaRoom.ts:607-621](../../backend/src/rooms/PartidaRoom.ts#L607-L621) e [PartidaRoom.ts:838-848](../../backend/src/rooms/PartidaRoom.ts#L838-L848) -- guards defensivos de `resolverRodada` (Super Trunfo e fluxo normal) que ficaram estruturalmente inalcançáveis via desconexão a partir desta história; comentários atualizados pra registrar isso
3. [MesaDeJogo.tsx:275](../../frontend/src/screens/MesaDeJogo.tsx#L275) -- key do oponente simplificada pra `sessionId` sozinho (achado de revisão: evita remount no momento da conversão pra IA)
4. [PartidaRoom.integration.test.ts:2546](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2546) -- describe da Matrix completa (6 testes: fora da vez, na própria vez, durante Revelando, durante SuperTrunfoAcionado, tentativa de retorno, regressão da Sala de Espera)
5. [PartidaRoom.integration.test.ts:2797](../../backend/src/rooms/PartidaRoom.integration.test.ts#L2797) -- teste adicionado na revisão pro cenário SuperTrunfoAcionado, incluindo a asserção de que o guard defensivo nunca dispara (`console.warn` não chamado)
6. [PartidaRoom.integration.test.ts:1293](../../backend/src/rooms/PartidaRoom.integration.test.ts#L1293) -- teste pré-existente da Story 2.3 reescrito pra provar o caminho feliz novo em vez do abort defensivo antigo
