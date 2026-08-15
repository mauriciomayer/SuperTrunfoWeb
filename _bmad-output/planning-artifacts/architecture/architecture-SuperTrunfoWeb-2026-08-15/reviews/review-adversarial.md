---
name: 'Super Trunfo Web'
type: architecture-review
review-kind: adversarial
target: '{planning_artifacts}/architecture/architecture-SuperTrunfoWeb-2026-08-15/ARCHITECTURE-SPINE.md'
created: '2026-08-15'
---

# Adversarial Review — Architecture Spine, Super Trunfo Web

## Method

Read `ARCHITECTURE-SPINE.md` in full, cross-referenced against `prd.md` (FRs, glossary, §8 Questões em Aberto) and `EXPERIENCE.md` (Padrões de Estado, Primitivas de Interação), and asked: *can two implementers, each following every AD to the letter, build pieces that don't interoperate?* Ten holes found. Each entry gives the scenario, why both builds comply with the current text, what breaks, and a concrete tightening.

---

## Hole 1 — Does "revelação" mean the whole Carta or just the Atributo value?

**Scenario.** Builder A implements the `Revelando` state by pushing a full `Carta` object (id, all 6 attributes, group, Super Trunfo flag) for each active player into the synced schema the moment the round enters `Revelando`. Builder B implements it by pushing only a scalar `{ jogadorId, valor }` for the one attribute that was selected, keeping the rest of the opponent's card attributes out of the schema entirely.

**Why both comply.** AD-3's rule says a client "never receives... a Carta from another player's Monte beyond the one explicitly in revelation in the current Rodada" — this reads as "the whole card being revealed is fine to send." But FR-11 (which AD-3 explicitly binds) says the system "reveals simultaneously **the value of the same Atributo**" — value, singular, not the card. `EXPERIENCE.md` Padrões de Estado adds a third, different signal: "Todas as Cartas da Rodada viram simultaneamente" (all cards *flip*), which visually implies a full-card reveal. The spine's AD-3 text is compatible with all three readings simultaneously — it never picks one.

**What's incompatible.** Builder A's backend sends 5 extra attributes per opponent card every round that Builder B's frontend has no field to read (or, worse, Builder B's frontend was built assuming those fields exist per the UX mockup's "card flip" animation, and gets `undefined` against Builder A's minimal payload). The two are not just visually different — one leaks strictly more opponent data than the other, which is exactly the anti-cheat failure class AD-3 exists to prevent, and there's no way to tell from the spine which one is "in violation."

**Tightening.** Extend AD-3's Rule with an explicit field-level statement, e.g.: *"On entering `Revelando`, the full `Carta` (all attributes, group, Super Trunfo flag) of each active player's current top card becomes visible to all clients — not just the selected attribute's value. Outside `Revelando`/`ResolvendoRodada`/`Funil`, only the count of an opponent's Monte is visible, never any card content."* Pin this to resolve the FR-11-vs-UX contradiction explicitly, don't leave it inferable.

---

## Hole 2 — `Rodada` and `Funil` are glossary-mandated identifiers with no schema shape

**Scenario.** The Consistency Conventions table requires domain terms — explicitly naming `Rodada` and `Funil` — to appear verbatim as identifiers in code. But the Structural Seed's `backend/src/schema/` line lists only `Carta, Monte, Jogador, EstadoPartida` as the Colyseus Schema classes. Builder A (working the game-loop story) puts round state as a nested class: `EstadoPartida.rodadaAtual: RodadaSchema { atributoSelecionado, jogadorDaVez, cartasEmDisputa }` and a `RodadaSchema.funil: ArraySchema<Carta>` sub-field. Builder B (working the Funil/desempate story, FR-18-20) instead adds flat top-level fields directly on `EstadoPartida` — `atributoAtual: string`, `cartasNaMesa: ArraySchema<Carta>`, `montePreso: ArraySchema<Carta>` — with no `Rodada` or `Funil` class anywhere, treating those as PRD glossary terms rather than schema types.

**Why both comply.** AD-3's Rule only names `Carta, Monte, Jogador, EstadoPartida`. Nothing in AD-5 or the Structural Seed says whether `Rodada`/`Funil` are schema *classes*, plain fields, or backend-only (non-synced) TypeScript objects. Both builders satisfy AD-1, AD-3, and AD-5's state diagram, and both use the glossary terms "somewhere."

**What's incompatible.** The `Funil` frontend component (explicitly listed in `frontend/src/components/`) needs a concrete field to bind to for "how many cards are pooled and whose." If the two stories are built independently against this spine, one back-end shape has `estado.rodadaAtual.funil` and the other has `estado.montePreso` — a frontend built against either name breaks against the other backend, and a third dev reading only the spine has no way to know which is canonical.

**Tightening.** Add explicit field-level schema sketches to the Structural Seed or a new AD-11, naming exactly: `EstadoPartida` top-level fields, whether `Rodada` is a nested schema class or inlined, and the exact field name/type holding Funil-pooled cards (e.g. `EstadoPartida.funil: ArraySchema<Carta>` + `EstadoPartida.funilDono: string`).

---

## Hole 3 — No message contract for triggering the Super Trunfo card

**Scenario.** FR-15 says a player "aciona a Carta Super Trunfo" but never defines the trigger action. AD-1's only worked example is `selecionarAtributo(nomeDoAtributo)`. `EXPERIENCE.md`'s only described interaction primitive is "clique único na Linha de Atributo" — there is no separate "play Super Trunfo" button or gesture described anywhere in the UX doc. Builder A (frontend) concludes the Super Trunfo card is played through the *same* `selecionarAtributo` call (any attribute row click on a Super Trunfo top card triggers auto-win server-side, ignoring which attribute was clicked) and never sends a distinguishing signal. Builder B (backend) registers a *separate* `onMessage('jogarSuperTrunfo', ...)` handler and expects the client to detect client-side that the top card is special and send a different message.

**Why both comply.** AD-1's rule text uses "ex:" (example) for `selecionarAtributo`, explicitly not claiming to be exhaustive — so a second intent name is permitted by the letter of AD-1. Nothing in AD-1, AD-4, or AD-5 enumerates the full message contract.

**What's incompatible.** Builder A's frontend never sends `jogarSuperTrunfo`; Builder B's backend has no handler for a `selecionarAtributo` call on a Super Trunfo card that both ignores the attribute name and produces the FR-15/16/17 exception logic. The Super Trunfo path either silently falls through to normal attribute comparison (breaking FR-15) or throws on an unrecognized message — and this is discoverable only at integration time, not from either side's story alone.

**Tightening.** Add a full message-contract table to the spine (new AD or expansion of AD-1): every client→server intent, its exact name, payload shape, and which states accept it. State explicitly whether Super Trunfo is triggered via `selecionarAtributo` with server-side card-type detection, or a distinct message.

---

## Hole 4 — AguardandoSelecao has three semantically different entry reasons, collapsed onto one state

**Scenario.** The AD-5 diagram shows three distinct incoming edges into `AguardandoSelecao`: from `ResolvendoRodada` ("vencedor definido" — turn *passes* to the winner), from `Funil` ("mesmo jogador escolhe novo Atributo" — turn *stays* with the same player), and a self-loop ("jogador eliminado, monte zerado"). Builder A implements this as three distinct code paths, each explicitly setting or preserving `jogadorDaVez` per the edge's semantics. Builder B implements a single `enterAguardandoSelecao()` handler triggered generically whenever the state field flips to that value, which recomputes "whose turn is it" from a single rule (e.g., "always the last round's winner") because that's the common case and the diagram doesn't say the recompute needs to be edge-aware.

**Why both comply.** AD-5's Rule only requires "estados nomeados e transições explícitas, conforme abaixo" — the diagram is a valid state graph either way; nothing in the prose distinguishes "turn changes here" from "turn does not change here" as different *entry actions* versus a shared *state*.

**What's incompatible.** Builder B's implementation silently advances the turn away from the Funil-originating player on every tie, breaking FR-19 ("o Jogador que abriu a Rodada empatada... escolhe o Atributo da Rodada de desempate") — a rules bug that only appears when the Funil story (built by someone else, against the same spine) is integrated with the turn-management code Builder B wrote for the non-tied path.

**Tightening.** Add prose to AD-5 stating explicitly: *"Entering `AguardandoSelecao` from `Funil` MUST preserve `jogadorDaVez` unchanged; entering it from `ResolvendoRodada` (non-tied) MUST set `jogadorDaVez` to the round's winner; the elimination self-loop MUST NOT alter `jogadorDaVez` except to skip a now-eliminated player in turn order."* Treat this as three named transition actions, not one shared `onEnter`.

---

## Hole 5 — AD-9's "próxima Rodada" boundary contradicts its own Prevents clause, given FR-19's wording

**Scenario.** FR-19 explicitly calls a Funil tie-break cycle "a Rodada de desempate" — i.e., per PRD terminology, *each* Funil sub-cycle is its own Rodada, not a sub-step of one Rodada. Builder A (implementing AD-9 reconnection) reads "controle... só volta pra ele no início da próxima Rodada" literally against this glossary and flips a disconnected human's seat back to them the instant `AguardandoSelecao` is re-entered — including mid-Funil-chain, i.e., right as the AI was about to pick the tie-break attribute. Builder B (implementing the game loop / AD-5) assumed the entire tied-chain (original tied Rodada + every Funil sub-Rodada until a clean winner) counts as one continuous unit for reconnection purposes, and only hands control back after the whole chain resolves.

**Why both comply.** AD-9's Rule never defines "Rodada" for its own purposes; it borrows the term from the glossary, which — per FR-19 — makes each Funil cycle its own Rodada. Builder A's reading is the more literal one.

**What's incompatible.** Builder A's implementation reintroduces exactly the failure mode AD-9's own Prevents clause names: *"handoff de controle no meio de uma jogada da IA, criando um estado ambíguo sobre quem decidiu o quê."* A human can be swapped into the seat mid-Funil-chain with no visibility into what the AI already committed to the pot, mid-decision. Builder B's implementation never exhibits this; the two behave differently on any tie, and only one of them actually satisfies AD-9's stated intent — but the spine's own text permits the reading that violates it.

**Tightening.** Add an explicit definition to AD-9: *"For reconnection purposes, a 'Rodada' is the entire tie-resolution chain — from the first attribute selection of a turn through every Funil sub-cycle it triggers, until a non-tied winner is declared. Control returns to the original player only after that whole chain resolves, never mid-chain."*

---

## Hole 6 — AD-4 constrains the AI decision *function*, not its *call site or timing*

**Scenario.** Builder A calls `decidirAtributoIA(estado, jogadorId)` synchronously, inline, inside the same handler/tick that transitions the room into `AguardandoSelecao` for an AI seat — no other message can be processed by the room in between. Builder B, wanting a "thinking..." pause for UX pacing (the EXPERIENCE.md doc is heavy on reveal/flip/confetti animation timing), wraps the same call in `room.clock.setTimeout(() => decidirAtributoIA(...), 1200)`. The decision function itself is still synchronous and in-process — no socket is added.

**Why both comply.** AD-4's Rule says the function is "síncrona e in-process — nunca um socket adicional." Builder B never adds a socket and the function itself never becomes async. The letter of AD-4 is satisfied.

**What's incompatible.** Builder B's version reopens a window — between entering `AguardandoSelecao` and the deferred callback firing — during which the room can process other messages: a reconnecting client's stale `selecionarAtributo`, a duplicate/racing message, or (per Hole 5) a reconnection handoff arriving mid-decision. This is precisely the "risco real de estado inconsistente (ex: dois Jogadores conseguindo selecionar Atributo na mesma Rodada)" that AD-5's Prevents clause calls out as the reason the state machine exists — yet nothing in AD-4 forbids it, because AD-4 only regulates the function, not the scheduling around the call.

**Tightening.** Tighten AD-4's Rule to state explicitly whether the AI call may be deferred relative to the state transition, and if UX pacing requires a delay, mandate a guard (e.g., "no other message affecting `jogadorDaVez`'s turn may be processed while an AI decision is pending for that seat" or "any delay must be purely visual/client-side — the server must apply `decidirAtributoIA`'s result atomically within the same transition that enters `AguardandoSelecao`, before any other message is dequeued").

---

## Hole 7 — Reconnection identity/session mechanism is unspecified, and the two plausible builds are not interoperable

**Scenario.** AD-9 says control "volta pra ele" (returns to the original player) on reconnect, but the spine never says how "original player" is verified — the PRD explicitly defers real auth ("identificação é só o nome digitado"). Builder A implements this using Colyseus's native `allowReconnection(client, seconds)` API: the client stores a reconnection token from the original session and replays it on rejoin within a timeout window. Builder B implements a simpler "claim by matching displayed name" flow: any new connection that types the same name as a disconnected seat reclaims it.

**Why both comply.** AD-9 only binds FR-23 and states the *outcome* (seat returns to original player at the right time); it says nothing about the *mechanism*, and the Deferred section explicitly punts "Autenticação/autorização real" out of scope, which reads as license to build either.

**What's incompatible.** These are architecturally incompatible: Builder A's frontend needs to persist and replay a reconnection token across reload; Builder B's frontend needs nothing but a name-entry field. If the frontend piece is built against Builder A's assumption and the backend against Builder B's (or vice versa), reconnection either never succeeds (frontend has no token, backend expects one) or silently over-succeeds (backend lets anyone type the same name and hijack any seat, including someone else's, mid-game — a real anti-cheat gap adjacent to what AD-3 is trying to prevent, but never addressed by it).

**Tightening.** Extend AD-9 (or add a new AD) to pin the mechanism explicitly: e.g., "Reconnection uses Colyseus `allowReconnection` bound to the original client's session/reconnection token, with a fixed timeout window (state the number). Name-matching alone is never sufficient to reclaim a seat."

---

## Hole 8 — AD-3 doesn't distinguish "canonical state" from "filtered client view" as two shapes

**Scenario.** AD-4 says `decidirAtributoIA(estado, jogadorId)` receives `estado` — and the AI clearly needs the *unfiltered* canonical state (it must know its own and the situation's real card values to decide well; in principle it could even need visibility other players don't have). AD-3 says the client-facing sync is filtered. Nothing states these are two different types. Builder A (writing `backend/src/game/`) designs all pure functions — comparison, Funil resolution, `decidirAtributoIA` — against one unfiltered internal `EstadoPartida` type that is the single source of truth, and treats AD-3 filtering as a separate serialization step applied only when writing to the network layer. Builder B, taking AD-3's "Colyseus StateView/schema filtering" literally, decorates the *actual* `EstadoPartida` schema class fields with `@filter()` per-client predicates and has `game/` functions (including `decidirAtributoIA`) operate directly on that same filtered-capable schema instance.

**Why both comply.** AD-3's rule cites "Colyseus StateView/schema filtering" as the mechanism without saying whether it's a decorator applied to the single canonical schema (Builder B's reading) or a separate outbound transform over an unfiltered internal model (Builder A's reading). Both nominally "filter by client" per the rule's wording.

**What's incompatible.** Under Builder B's design, if a `@filter()` predicate has a bug (the exact failure class AD-3's Prevents clause is written to guard against — "falha real — quase repetida durante a fase de UX"), the *canonical* game-logic state itself is corrupted/incomplete for players like `decidirAtributoIA`, which needs full information regardless of which client is asking — an AI decision could be computed against data that's missing because a filter predicate happened to exclude it. Builder A's split design has no such risk by construction. Two stories built against each assumption produce genuinely different security postures, and nothing in AD-3 tells a third implementer which one the architecture actually intends.

**Tightening.** Add an explicit sentence to AD-3: *"There are two representations: an unfiltered canonical `EstadoPartida` used by all `backend/src/game/` logic and `decidirAtributoIA`, and a per-client filtered view applied only at the network-serialization boundary. Game rule functions never read the filtered view."*

---

## Hole 9 — "Jogador Inicial" (FR-9) determination rule is unstated anywhere, including in the spine

**Scenario.** FR-9 requires "exatamente um Jogador inicial" before the first Rodada, but neither the PRD nor the spine's AD-5 diagram (whose first transition label, "host inicia," is about the host clicking Start, not about who gets the first pick) states the algorithm. Builder A assumes the host is always first (simplest, matches "host inicia" superficially). Builder B assumes a random seat is chosen server-side at match start (matches "unpredictable/fair" instincts for a card game).

**Why both comply.** Nothing in AD-2, AD-5, or the Structural Seed pins this down; FR-9's only testable consequence is "exactly one initial player is defined," which both satisfy.

**What's incompatible.** Lower severity than the others, but real: unit tests written against one assumption (e.g., "host always opens Rodada 1") fail against the other implementation if two stories/tests are authored independently, and UX copy or FAQ content describing "who goes first" (FR-24) could describe a rule the actual backend doesn't implement.

**Tightening.** Add one line to AD-5 or AD-2 pinning the rule, e.g.: "O host é sempre o Jogador Inicial da primeira Rodada" (or the random-seat alternative, explicitly chosen).

---

## Hole 10 — AD-6's remainder rule is stated as a fact about N=3, not a general formula

**Scenario.** AD-6's Rule is phrased entirely in terms of the one case that currently produces a remainder ("Com 3 Jogadores, 32 Cartas viram 10 por Jogador... as 2 Cartas restantes são descartadas"), not as `cartasPorJogador = Math.floor(32 / n)`, `descartadas = 32 % n`. For the currently supported range (FR-5: 2-4 players), N=2 and N=4 divide evenly, so this doesn't bite today. But if a shared "distribuir cartas" utility is written by one builder as a literal `if (jogadores.length === 3) descartar(2)` special case, and a second builder (writing a different story that also touches distribution, e.g. a "start match" handler) assumes the utility generalizes and calls it with N up to whatever `PartidaRoom` accepts, the special-cased version silently does nothing for any N it wasn't hardcoded for.

**Why both comply.** AD-6's Rule only makes the N=3 claim; it never says whether the rule generalizes.

**What's incompatible.** Low severity given the current 2-4 player range, but it's a latent trap: the two implementations are behaviorally identical today and diverge silently only if player-count range ever changes, which is exactly the kind of thing that doesn't get caught by tests written against the current range.

**Tightening.** Restate AD-6's Rule as the general formula, with the N=3 case as a worked example rather than the whole rule.

---

## Summary Table

| # | Hole | Severity | AD(s) touched |
|---|---|---|---|
| 1 | Full-card vs. attribute-value-only reveal | High | AD-3 (contradicts FR-11 / EXPERIENCE.md) |
| 2 | No schema shape for `Rodada`/`Funil` | High | AD-3, AD-5, Structural Seed |
| 3 | No message contract for playing Super Trunfo | High | AD-1, AD-4 |
| 4 | `AguardandoSelecao` has 3 unstated entry semantics | Medium-High | AD-5 |
| 5 | AD-9 "próxima Rodada" boundary contradicts its own Prevents clause | High | AD-9 (vs. FR-19) |
| 6 | AD-4 regulates the function, not the call timing | Medium-High | AD-4 (vs. AD-5) |
| 7 | Reconnection identity mechanism unspecified | Medium | AD-9 |
| 8 | No canonical-vs-filtered state type distinction | Medium | AD-3, AD-4 |
| 9 | "Jogador Inicial" algorithm unstated | Low | AD-5/AD-2 |
| 10 | AD-6 remainder rule stated as a special case, not a formula | Low | AD-6 |

10 holes found overall: 3 high, 3 medium-high, 2 medium, 2 low.
