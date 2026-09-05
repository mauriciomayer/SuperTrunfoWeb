# Epic 7 Context: Sala Confiável e Resultado no Instante Certo

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic fixes a real production bug found via log investigation: during a live demo to family, guests couldn't join because the host's own connection silently dropped shortly after room creation, and Colyseus's default behavior (a room with no real client connected self-destroys instantly) tore down the room before anyone noticed. The epic gives the Waiting Room a short tolerance window for brief disconnects before the seat/room is torn down, and makes a player's own connection drop visible immediately instead of silently. Separately, it moves round-winner calculation to the moment cards are revealed rather than the moment the next round starts, so the Result Chip appears when players actually need it.

## Stories

- Story 7.1: Reconexão Curta na Sala de Espera
- Story 7.2: Aviso de Conexão Perdida na Sala de Espera
- Story 7.3: Chip de Resultado Aparece Junto com a Revelação

## Requirements & Constraints

- A brief, abrupt disconnect of any player (including the host) while still in the Waiting Room (state `AguardandoJogadores`, match not yet started) must not tear down the seat or the room instantly — a short tolerance window must pass first.
- If that player reconnects (reopens the same link) before the window expires, they resume the exact same Waiting Room seat, without losing their place or needing to recreate the room.
- If the window expires with no reconnection, existing behavior stands unchanged: seat removed; room destroyed if no real client remains.
- This tolerance window applies only before the match starts. Once any state beyond `AguardandoJogadores` is reached, the already-confirmed behavior from Story 3.2 continues exactly as-is (disconnected human's seat permanently becomes AI; no reconnection ever, mid-match) — this epic never touches that path.
- A player in the Waiting Room must see a clear, immediate warning when their *own* connection drops (whether it fails to reconnect within the tolerance window, or a hard connection error occurs) instead of the screen silently continuing to show the last known state. The warning must guide the needed action (create the room again).
- Winner/attribute/win-type for a round must be calculated as soon as the state machine enters `Revelando` or `SuperTrunfoAcionado` — not deferred until the reveal pause ends. The Result Chip must appear at that same instant.
- The actual consequences of the round (moving cards to the winner's pile, changing `jogadorDaVez`, deciding Funil/elimination/end-of-match) must still only be applied after the existing reveal pause, exactly as today — only the *calculation + chip display* timing moves earlier, not the state transition itself.
- Outside `Revelando`/`SuperTrunfoAcionado` (e.g. `AguardandoSelecao`, between rounds), the Result Chip must never appear, regardless of the value left in `ultimoResultado`.
- Confirmed root cause (from a real Render production log, session of Sept 2): not a free-tier cold start (process had been up >20s before room creation) and not a guest's mobile carrier network issue. The host's *own* connection dropped ~28s after creating the room — consistent with switching apps to share the invite link via WhatsApp, which commonly suspends a backgrounded tab/WebSocket. The room self-destroyed the same instant (Colyseus default: room with zero real clients disposes itself); guests clicking seconds later correctly got "room does not exist" because it truly no longer existed.

## Technical Decisions

- State machine (authoritative, server-side): `AguardandoJogadores → AguardandoSelecao → Revelando → ResolvendoRodada → (Funil | AguardandoSelecao | FimDePartida)`, plus `SuperTrunfoAcionado`. All game state mutation goes through Room message handlers, never direct schema mutation.
- The architecture already envisioned a reconnection mechanism in general terms (Colyseus `allowReconnection` + a session token + a short tolerance window) before it was later narrowed down to a single confirmed decision: no reconnection at all once a match is in progress (Story 3.2). The Waiting Room phase itself was never explicitly decided either way — Story 7.1 fills that specific gap using the *same* mechanism the architecture already described, but scoped exclusively to before the match starts. It does not reopen or revise the in-progress-match decision.
- `SalaDeEspera` (frontend) currently does not handle `room.onLeave`/`room.onError` at all — this is pre-existing tracked tech debt from Story 1.2, now directly in scope for Story 7.2.
- For Story 7.3: decouple *when the winner is computed* from *when its consequences are applied*. Compute and expose the round result as soon as `Revelando`/`SuperTrunfoAcionado` is entered; keep applying card movement/turn change/Funil/elimination/end-of-match only after the existing pause elapses.
- This should let the Result Chip's visibility simply follow whether `estado` is `Revelando` or `SuperTrunfoAcionado`, potentially removing the client-side timer/transition-tracking mechanism added in Story 6.3 (`useEffect` with `estadoAnteriorRef`/`timerEsconderChipRef`/`mostrarChipResultado` in `MesaDeJogo.tsx`) — evaluate during investigation whether it can be fully removed or still serves some residual case; don't assume removal without checking.
- This also closes out the pre-existing `ultimoResultado` bug (tracked since Story 5.1): it's currently only cleared on the tie branch, so it goes stale and gets silently overwritten rather than cleared on a normal win. Once the Chip is tied to the revelation states, that staleness stops mattering because nothing reads it outside those states anymore.
- Performance constraint carries over: round transitions/comparisons/animations must stay within 1.5s of server processing.

## UX & Interaction Patterns

- No existing design doc component covers a "connection lost" warning in the Waiting Room — this is new ground for Story 7.2, not a documented UX-DR. Follow the project's existing voice/tone conventions when writing it: direct Portuguese microcopy, warm but not infantilized, domain terms from the glossary used verbatim, no technical jargon exposed to the player (e.g. never surface words like "estado sincronizado" or "payload").
- The existing Waiting Room state pattern for "someone leaves before the match starts" is: they simply disappear from the Waiting Room list, with no Monte/game state to preserve yet. Story 7.1's tolerance window sits in front of that existing behavior, not in place of it.
- Result Chip visual spec (starburst shape, semantic border color + always-present text, never color-only) is unchanged by Story 7.3 — only its *timing* changes.

## Cross-Story Dependencies

- Story 7.2's warning trigger depends on Story 7.1's tolerance-window semantics: the warning should fire specifically when that window expires without reconnection, or on a hard connection error — so 7.2 should be built against 7.1's actual window/event behavior, not independently guessed.
- Story 7.3 is otherwise independent of 7.1/7.2 (different subsystem: Mesa de Jogo round revelation vs. Waiting Room connection handling), but it directly revisits the Story 6.3 Result Chip auto-hide mechanism — check that mechanism's current implementation in `MesaDeJogo.tsx` before deciding whether to remove, simplify, or keep it alongside the new state-driven visibility.
