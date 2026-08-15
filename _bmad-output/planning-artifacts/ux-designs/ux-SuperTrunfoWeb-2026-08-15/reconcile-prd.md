---
title: Reconciliation Audit — PRD vs DESIGN.md / EXPERIENCE.md
created: 2026-08-15
status: read-only audit, no source files modified
---

## 1. Verdict

**Faithful, with minor gaps.** No material contradictions of PRD functional behavior; the one deliberate scope extension (bot takes over a disconnected player's seat mid-game) is already flagged inline in EXPERIENCE.md as required. One additional undeclared inconsistency and two small glossary slips were found; both are cosmetic/clarification-level, not blocking for a hobby-stakes MVP.

## 2. Findings

### 2.1 Scope extension check (the one you asked to confirm)
- Confirmed: the disconnect→bot-takeover extension (EXPERIENCE.md, Padrões de Estado → "Conexão perdida", and Questões em Aberto #3) is the only deliberately flagged extension, correctly marked `[NOTE FOR PM]`.
- **Found a second, unflagged inconsistency** that is scope-adjacent: the "Criar Sala" row in Information Architecture (EXPERIENCE.md line ~26) has the host pre-declare **"quantos são IA"** (a target AI-seat count) at room-creation time, before anyone has joined. Elsewhere — Padrões de Estado → "IA preenchendo vaga" and Fluxo 2 — the mechanism described is FR-5's actual behavior: AI fills whatever seats are *still empty* when the host clicks "Iniciar", not a host-chosen fixed AI quota set in advance. These are two different room-configuration models (pre-set AI quota vs. dynamic backfill of unfilled seats) and the doc doesn't reconcile them. Not a contradiction of the PRD outright (PRD is silent on room-creation UI), but it is an internal EXPERIENCE.md inconsistency that should be resolved (and probably dropped in favor of the FR-5-faithful dynamic version) before Architecture — same class of issue as the disconnect note, but currently unflagged.

### 2.2 Glossary drift (minor, non-blocking)
- DESIGN.md line 87: "...pra ela se destacar **na mão do Jogador** antes mesmo de ser jogada." Uses "mão" (hand) as a colloquial stand-in for the PRD's "Monte." Cosmetic — it's descriptive prose about a visual effect, not a UI label — but technically not the PRD's exact term.
- EXPERIENCE.md line 128 (Fluxo 2): "...reagindo às Rodadas **nos turnos dela**..." — PRD's own vocabulary is "Jogador da vez" (see FR-10), not "turno." Minor synonym slip in narrative prose, not in the Padrões de Estado table (which correctly uses "Jogador da vez").
- Everywhere else, both documents use Carta, Monte, Rodada, Partida, Funil, Grupo, Atributo, Jogador, Super Trunfo verbatim and correctly, including in the Padrões de Estado / Padrões de Componente tables where it matters most (actual UI copy and labels).

### 2.3 FR coverage check
All FRs with a genuine user-facing surface are covered:
- FR-2/3/4 (card ID, Super Trunfo flag, Grupo) → Carta component in DESIGN.md.
- FR-5 (AI fills seats) → Sala de Espera, "IA preenchendo vaga" state (see 2.1 caveat above on the creation-time quota).
- FR-8 (Monte FIFO, top-only visible) → "Carta (própria)" / "Carta (oponente, oculta)" components.
- FR-9/10 (initial player, attribute selection) → "Aguardando seleção" state, Linha de Atributo.
- FR-11 (simultaneous reveal) → "Revelação" state.
- FR-13/14 (collection, next-round choice) → Banner de Vitória (Rodada); implicit but consistent.
- FR-15/16/17 (Super Trunfo + letter-A exception) → "Super Trunfo acionado" state, explicitly handles both outcomes.
- FR-18/19/20 (Funil) → "Empate → Funil" state, correctly attributes the re-pick to the original chooser (FR-19).
- FR-21/22 (elimination, end of match) → "Jogador eliminado" state, Fim de Partida surface.

FRs with no (and no expected) user-facing surface — correctly not represented in the UX docs: FR-1 (deck instantiation), FR-6 (shuffle), FR-12's inverse-attribute comparison logic (pure backend comparison; UI just shows the result either way).

Genuine minor gap: **FR-7's remainder rule** (uneven distribution when player count doesn't divide 32 evenly, e.g. 3 players) has no UX surface at all — no state, no copy, nothing acknowledges an uneven deal happened. Low severity: the PRD itself leaves the actual rule as an open question (§8.3, deferred to Architecture), so the UX doc had nothing concrete to build against yet. Worth a follow-up state/copy once that rule is decided, but not a defect of this UX pass.

### 2.4 Contradictions
None found in game-loop behavior. The only candidate is the AI-quota inconsistency in 2.1, which is a doc-internal ambiguity rather than a PRD contradiction.

## 3. Notes for a hobby-stakes project (not action items, just observations)
- RNF-1 caps card-related animation/processing at 1.5s server-side; EXPERIENCE.md's "flying cards" + confetti animations don't state a duration budget. Worth a passing sanity check when animations are built, not worth specifying now.
- Open edge case correctly deferred by both docs: "alguém fecha a aba durante a Sala de Espera" (EXPERIENCE.md, end of Fluxo 1) is explicitly marked undefined — reasonable to leave open at this fidelity.
- The `[ASSUMPTION]` tags throughout DESIGN.md (font family, exact hex readings, corner-radius softening for touch) are appropriately scoped as pending-mockup decisions, not premature commitments — fine for this stage.
- Given this is a closed-circle, link-invite hobby game, the lack of any onboarding/tutorial UI (explicitly rejected in EXPERIENCE.md's Anti-padrões) is a reasonable and well-justified call, not a gap.
