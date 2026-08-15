# Spine Pair Review — Super Trunfo Web

## Overall verdict

The spine pair is well-shaped and appropriately lean for a hobby project — section order matches the canonical DESIGN.md structure exactly, both triggered EXPERIENCE.md sections (Responsive & Platform, Inspiration & Anti-patterns) are present with honest trigger justifications, and prose stays disciplined about tagging assumptions rather than inventing unconfirmed detail. It is not yet clean as a downstream contract: a consumer following the document's own internal pointers hits two dead ends (a DESIGN.md component that says "see EXPERIENCE.md" where nothing exists, and a flow edge case that says "see Open Questions" where nothing exists), and two load-bearing game mechanics — the Funil's visual treatment and what happens when a disconnected player reconnects — are left completely unaddressed rather than flagged as open questions like every other gap in the document. Close the 2 critical + 2 high items below before handing this to architecture/story-dev; the mediums are worth a pass but won't block extraction.

## 1. Flow coverage — adequate

Two Key Flows, both with numbered steps and an explicit **Clímax** beat. Flow 1 (Mauricio) is solid: named protagonist, 7 steps, climax, edge case noted. Flow 2 is thinner: protagonist is never named ("um amigo"), and it has no failure/edge-case path at all.

### Findings
- **critical** Fluxo 1's edge case ("alguém fecha a aba durante a Sala de Espera") is tagged `[NOTE FOR UX]` and says "ver Questões em Aberto" — but the Questões em Aberto list (3 items: attribute-confirmation, typography/hex, FR-5 NOTE FOR PM) never actually covers this scenario. The pointer doesn't resolve. (EXPERIENCE.md, Fluxo 1 "Caso de borda" line, vs. "Questões em Aberto (UX)" §1-3). *Fix:* either add a 4th open question covering the waiting-room disconnect case, or resolve it inline and drop the pointer.
- **medium** Flow 2's protagonist has no name, only a role label ("um amigo sozinho à noite"), unlike Flow 1 (Mauricio) and every flow in both reference examples (Mira, Sarah, Devon/Mara). (EXPERIENCE.md, "Fluxo 2 — IA preenche a mesa"). *Fix:* give the protagonist a name for consistency and concreteness.
- **medium** Flow 2 has no failure or edge-case path at all — Flow 1 at least flags one (even if unresolved, see above). (EXPERIENCE.md, Fluxo 2). *Fix:* add at least one edge case, e.g. what happens if the minimum of 2 total Jogadores is never reached, or AI takeover fails.
- **low** Flow 1's own edge case, independent of the broken pointer above, is substantively unresolved ("comportamento não definido pela Discovery") — so even once the reference is fixed, no actual behavior exists for downstream consumers to build against.
- **low** Neither flow walks through Fim de Partida, the Funil (tie), Super Trunfo, or elimination — all FR-15–22 core mechanics are only described in the State Patterns table, never stitched into a flow narrative. Acceptable at hobby scale but worth noting since these are the game's most distinctive rules.

## 2. Token completeness — adequate

All 13 color tokens have hex values — no critical misses there. Every `{path.to.token}` reference found in prose resolves to a defined frontmatter token. The gaps run the other direction: tokens defined but never wired to anything, and prose-described components with no frontmatter backing.

### Findings
- **medium** `colors.tie-amber` has a hex value and is named in prose ("Âmbar de Empate... indicam o resultado de uma Rodada") but is never referenced via `{colors.tie-amber}` anywhere, and — critically — the "Empate → Funil" state row in EXPERIENCE.md never cites it, unlike `eliminated-red`, which is explicitly wired to the "Jogador eliminado" state (`ver DESIGN.md.colors.eliminated-red`). (DESIGN.md line 83; EXPERIENCE.md "Empate → Funil" row). *Fix:* wire tie-amber into the Funil state/visual treatment the same way eliminated-red is wired into elimination.
- **medium** `colors.card-paper-raised` (`#FFFFFF`) and `rounded.full` (`9999px`) are defined in frontmatter but never referenced anywhere in either document's body. No consumer can tell what they're for. (DESIGN.md frontmatter lines 13, 35). *Fix:* wire them to a real use (e.g. a pressed/raised card state, a pill-shaped badge) or remove them.
- **medium** Three of the six components documented in DESIGN.md's "## Componentes" prose section — Carta (verso/oculta), Lista da Sala de Espera, Banner de Vitória / Confete — have no matching object in the frontmatter `components:` block, even though their prose describes specific token usage inline (`{colors.table-felt-shadow}`, `{colors.win-green}`, `{colors.hairline}`). Only carta, carta-super-trunfo, linha-atributo, linha-atributo-selecionada, botao-primario, and badge-pais are backed by frontmatter. (DESIGN.md frontmatter lines 44-67 vs. body lines 109-116). *Fix:* add frontmatter component objects for the missing three, for consistency with the spec's "components map to token objects" contract.

## 3. Component coverage — thin

Six components appear in DESIGN.md's Componentes section; five appear in EXPERIENCE.md's Padrões de Componente table. The one that's missing is explicitly pointed to from the other document, which makes the gap a broken reference rather than a simple omission.

### Findings
- **critical** `Botão Primário` has a DESIGN.md row that explicitly defers to the other spine — "usado para ações centrais (criar sala, confirmar escolha se o teste indicar que vale a pena — **ver EXPERIENCE.md**)" — but EXPERIENCE.md's Padrões de Componente table has no Botão Primário row at all (only Carta, Carta (verso), Linha de Atributo, Lista da Sala de Espera, Banner de Vitória). (DESIGN.md line 114; EXPERIENCE.md lines 51-57). *Fix:* add a Botão Primário row covering enabled/disabled logic (currently scattered across State Patterns) and the Variant A/B confirm-button behavior from Fluxo 1.
- **high** The Funil is a core FR-18-20 mechanic with an explicit visual behavior described in EXPERIENCE.md ("Cartas da Rodada visualmente movidas para uma área central") but has no visual specification anywhere in DESIGN.md — no component row, no color, no shape treatment for the área central on the felt. (EXPERIENCE.md "Empate → Funil" row; absent from DESIGN.md Componentes). *Fix:* add a Funil / área-central component entry to DESIGN.md.
- **low** Naming drift between spines for the same component: DESIGN.md "Carta (revelada)" vs. EXPERIENCE.md "Carta"; DESIGN.md "Carta (verso/oculta)" vs. EXPERIENCE.md "Carta (verso)". Conceptually mapped, not string-identical. *Fix:* align exact names across both documents.

## 4. State coverage — adequate

The Padrões de Estado table is reasonably thorough for Mesa de Jogo (8 of 11 rows), but two gaps stand out because, unlike every other unresolved item in this spine, they aren't flagged as assumptions or open questions — they're just absent.

### Findings
- **high** No state is defined for what happens when a disconnected player — whose seat a bot took over per "Conexão perdida" — reconnects mid-Partida. Does control return to the human? Immediately, or at the next Rodada boundary? This is silently unaddressed, unlike the FR-5 extension it's built on top of, which *is* flagged as a `[NOTE FOR PM]`. (EXPERIENCE.md, "Conexão perdida" row). *Fix:* add a "Reconexão" state row, or explicitly defer it to Architecture as an open question.
- **medium** No validation state exists for the host's player-count/AI-count selection at Criar Sala, even though FR-5 bounds it to 2-4 total Jogadores. What happens if the host tries an out-of-range value? (EXPERIENCE.md, IA table "Criar Sala" row; Padrões de Estado table). *Fix:* add a bounds-validation state, or explicitly note it's deferred to Architecture (the way the FR-7 leftover-cards rule already is in the PRD).
- **low** A player disconnecting during Sala de Espera (as opposed to during Mesa de Jogo) has no state row — it only surfaces as the unresolved Fluxo 1 edge case, whose own pointer to Questões em Aberto doesn't resolve (see Flow coverage, finding 1).

## 5. Visual reference coverage — adequate

The single imported reference (`imports/carta-exemplo-referencia.png`) is correctly linked in DESIGN.md's frontmatter `sources` and named inline in EXPERIENCE.md's Inspiração & Anti-padrões section.

### Findings
- **low** Neither document states a general "spine wins over the source image on conflict" rule. The only precedence statement present governs future mockups ("→ Referência de composição: mockups a produzir em `mockups/`... "), not the already-imported photo. One real conflict — corner radius (sharp in the photo vs. rounded in the spec, for touch usability) — is resolved ad hoc inline via an `[ASSUMPTION]` tag rather than under a general rule. *Fix:* add one sentence establishing that the spine overrides the source image wherever they conflict.

## 6. Bloat & overspecification — strong

No findings. Token usage stays lean; `[ASSUMPTION]` tags are used consistently instead of inventing unconfirmed detail (fonts, exact hex provenance); tables are used where a table fits (Do's/Don'ts, IA, State Patterns, Voice and Tone) instead of prose; no pixel-chasing beyond what tokens already cover. Calibration to hobby stakes is appropriate throughout — this is not over-engineered.

## 7. Inheritance discipline — adequate

All EXPERIENCE.md frontmatter `sources` resolve on disk: `prd.md`, `brief.md`, `research.md`, `docs/requisitos_super_trunfo.md`, and `docs/carros_specs.csv` all exist, and the `{planning_artifacts}` alias resolves via `_bmad/bmm/config.yaml` (`_bmad-output/planning-artifacts`). DESIGN.md's single source (the imported PNG) resolves and renders correctly. Glossary terms (Carta, Monte, Rodada, Partida, Grupo, Atributo, Jogador) are used consistently across both spines — the memlog records an earlier pass that already fixed drift ("mão do Jogador" → "Carta do topo do Monte", "turnos dela" → "Jogador da vez"), and that fix held.

### Findings
- Component name drift and the Funil's missing visual counterpart are inheritance-discipline symptoms too, but are not re-counted here — see Component coverage, findings 2-3.

## 8. Shape fit — strong

No findings. DESIGN.md's body section order matches the canonical order exactly: Marca & Estilo → Cores → Tipografia → Layout & Espaçamento → Elevação & Profundidade → Formas → Componentes → O Que Fazer e Não Fazer. EXPERIENCE.md carries all required default sections plus both correctly-triggered ones (Responsive & Platform, Inspiration & Anti-patterns), each with an explicit trigger justification ("Disparado — ..."), in the same order as the shadcn reference example. The closing "Questões em Aberto (UX)" section is a reasonable, transparent addition beyond the canonical shape, not a violation — though see Flow coverage finding 1 for a case where it's referenced but incomplete.

## Mechanical notes

- **Broken cross-references (2):** DESIGN.md → EXPERIENCE.md for Botão Primário (no target); EXPERIENCE.md Fluxo 1 → Questões em Aberto for the waiting-room tab-close case (no target).
- **Orphaned frontmatter tokens:** `colors.card-paper-raised`, `rounded.full` — defined, never referenced.
- **Under-wired token:** `colors.tie-amber` — defined and named in prose, never `{}`-referenced or tied to the Funil state it presumably describes.
- **Frontmatter/prose mismatch:** 3 of 6 DESIGN.md Componentes entries (Carta verso/oculta, Lista da Sala de Espera, Banner de Vitória/Confete) lack frontmatter `components:` objects that the other 3 have.
- **Name inconsistencies:** "Carta" (EXPERIENCE) vs. "Carta (revelada)" (DESIGN); "Carta (verso)" vs. "Carta (verso/oculta)".
- **Frontmatter completeness:** all colors have hex; typography tokens are `note`-only (qualitative, `[ASSUMPTION]`-tagged, deferred to mockup stage) rather than the spec's usual `fontFamily`/`fontSize`/etc. shape — acceptable at this stage but a known gap for whoever builds the first mockup.
- **Sources:** all 6 source paths across both files (5 in EXPERIENCE.md, 1 in DESIGN.md) resolve on disk; `{planning_artifacts}` alias confirmed in `_bmad/bmm/config.yaml`.

**Severity tally:** 2 critical, 2 high, 6 medium, 4 low (14 findings total).
