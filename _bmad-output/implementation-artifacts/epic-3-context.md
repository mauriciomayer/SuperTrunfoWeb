# Epic 3 Context: Jogador Artificial & Continuidade

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic keeps a match playable even when there aren't enough humans present. It has two parts: AI actually plays turns (selects attributes, triggers Super Trunfo, etc.) for any seat not filled by a human — both seats explicitly declared as AI at room creation and any human seat still empty when the host starts the match — and if a connected human drops mid-match, an AI permanently takes over their pile and exact state so the game never stalls for the remaining players. Without this epic, a match cannot start (or survive) with fewer humans than the declared player count, which is a core supported scenario (2-4 players, hobby use among family/friends).

## Stories

- Story 3.1: IA Preenche e Joga
- Story 3.2: Continuidade por Desconexão

## Requirements & Constraints

- A match supports 2-4 players total (humans + AI); it never starts with fewer than 2 total.
- AI seat count is declared explicitly by the host at room creation, in addition to the total player count.
- Any human seat still unfilled when the host starts the match automatically becomes AI (safety net) — this applies even if a player who joined the waiting room later leaves before start.
- If a connected human loses connection during an in-progress match, their seat is taken over by AI, which continues from their exact pile and state (pile is never lost or reset).
- Disconnection hand-off to AI is permanent for the rest of the match: there is no reconnection mechanism in this version. If the original player reopens the invite link, they never regain the seat under any circumstance, even mid-match.
- Server-side processing budget: round transitions, comparisons, and card animations must stay within 1.5s of server processing (applies to AI-driven turns too, since the AI's decision is part of that transition).
- Each seat's pile state must remain protected from client inspection outside its proper reveal moment (anti-cheat), regardless of whether the seat is human- or AI-controlled.

## Technical Decisions

- **AI runs in-process, applied atomically.** When the current-turn player is AI, the room's state machine calls `decidirAtributoIA(estado, jogadorId)` synchronously and in-process — never as a separate network client/socket. The result is applied atomically within the same transition that enters `AguardandoSelecao`, before any other message is processed by the room.
- **No server-side "thinking" delay.** If a visual pacing effect (AI "thinking") is desired, the delay must be client-side only — the server has already decided and transitioned state; the client merely delays display. Never add a `setTimeout`/delay on the server between entering the state and applying the AI's decision, since that would reopen the concurrent-message window the state machine is designed to keep closed (e.g., two plays in the same round).
- **AI reads only the canonical, unfiltered match state** (`EstadoPartida`), same as all game-rule logic in `backend/src/game/` — never the network-filtered per-client view.
- **AI mutates state through the same message handlers a human would use** — never a separate mutation path. All state mutation goes through Room message handlers (`onMessage`).
- **Disconnection is permanent by deliberate design choice**, to avoid the complexity a reconnection mechanism would add (control hand-off mid-AI-turn or mid-Funil chain, session token/time-window management, spectator state) — this was judged to not deliver real value for the current hobby-scale use case (short matches among family/friends, where starting a new match is an acceptable fallback). This is explicitly flagged as revisitable if the project grows beyond hobby scope, but out of scope for this epic.
- Domain terms (`Jogador`, `Monte`, `Rodada`, etc.) are used verbatim in Portuguese in code per project convention.

## UX & Interaction Patterns

- Waiting-room list shows each seat as either the human's name or an "IA" pill; this updates in real time as seats resolve to AI (both at explicit declaration and via the start-time safety net).
- On disconnection mid-match, there is no dedicated "player left" screen — the AI simply continues playing that seat's turns on the existing Mesa de Jogo surface; other players see the match continue uninterrupted, with no indication required beyond however active/eliminated seats are already shown.
- If the original disconnected player reopens the invite link, there is no defined return screen or state — they do not recover the seat.

## Cross-Story Dependencies

- Depends on Epic 1 (Story 1.2 Criar Sala) for the host's explicit AI-count declaration at room creation, and Story 1.4 (Sala de Espera) for the seat list/AI-pill display and the minimum-2-players start gate.
- Depends on Epic 2's game state machine (`AguardandoSelecao` and the full round-resolution flow) since AI plays through the exact same transitions and message handlers as a human — Story 3.1 has no independent turn-taking path.
- Story 3.2's takeover reuses the same seat/state model as Story 3.1's AI-fills-vacant-seat behavior; both result in a seat being AI-controlled, just triggered differently (pre-start vacancy vs. mid-match drop).
