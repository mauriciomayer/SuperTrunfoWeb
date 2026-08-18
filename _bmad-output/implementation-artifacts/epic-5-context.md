# Epic 5 Context: Polish Pós-Lançamento

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic is distinct in origin from Epics 1-4: it was not derived from the original PRD/UX/Architecture planning docs, but raised directly by Mauricio in a post-launch feedback session after Epics 1-4 were already live and the family was playing real matches. It bundles eight small, independent bug fixes and enhancements found through real usage: the round-result chip getting lost below the fold, country flags not rendering on Windows, a one-click invite-link copy, real car photos and names on the card, swapping which car holds the Super Trunfo flag, a decimal-precision display bug, and showing the player's own remaining-card count. There is no new architecture or UX spec written specifically for this epic — apply the existing patterns below where they're genuinely relevant, and treat anything not covered here as undecided.

## Stories

- Story 5.1: Resultado da Rodada Sempre Visível
- Story 5.2: Bandeiras de País como Imagem Real
- Story 5.3: Compartilhar Link da Sala
- Story 5.4: Fotos Reais dos Carros
- Story 5.5: Trocar a Carta Super Trunfo
- Story 5.6: Precisão Numérica dos Atributos
- Story 5.7: Nome do Carro na Carta
- Story 5.8: Contagem Própria de Cartas na Mesa

## Requirements & Constraints

- The round-result chip must be visible without scrolling on both mobile and desktop, and stay legible for the whole ~2.5s reveal window even if the rest of the table doesn't fit the viewport.
- Country flags must render as real image assets (SVG/PNG), never OS emoji — must look identical across Windows, macOS, and Android. `docs/carros_specs.csv` stays the source of truth for country data; only the visual representation changes.
- The host must be able to copy the room invite link in one click/tap, with visible confirmation that the copy succeeded.
- Each card shows the real photo of its car, loaded from an image file referenced in the deck data, replacing the current placeholder (🚗).
- `docs/carros_specs.csv` remains the source of truth for car data and gains a new `Imagem` column rather than migrating to a different format; the loading pipeline must propagate this field end to end.
- Origin of the 32 car photos to commit is undecided (Mauricio has photos today but is open to safer-licensed alternatives) — must be resolved as an "Ask First" before committing any images, and whatever is chosen must be committed to the repo (not left external) so a fresh clone has complete assets.
- The Jaguar F-Type R (`6D`) becomes the Super Trunfo card, replacing the Ferrari 812 Superfast (`2A`); the deck must still contain exactly 32 cards with exactly one Super Trunfo flag.
- Numeric attribute values shown to players must match the exact decimal precision of `docs/carros_specs.csv` — no floating-point artifacts (e.g. never `3.200000047683716`).
- The car's model name must be displayed on the card, positioned between the photo and the first attribute row (Velocidade Máxima).
- The player's own remaining-card count must be visible on the table during an active match, using the same visual pattern already used for opponents' counts.
- Responsiveness (mobile and desktop) applies across this epic, particularly to Story 5.1's visibility fix.

## Technical Decisions

- Frontend (`frontend/`) and backend (`backend/`) remain independent packages with no code import between them — all communication is over the network (Colyseus/WebSocket protocol).
- Data flow for car/deck fields is one-way: `docs/carros_specs.csv` → `backend/src/game/baralho.ts` (loading) → `backend/src/schema/Carta.ts` (schema) → frontend `Carta` component. New fields (image path, precision-safe numeric values) must be propagated through this same pipeline.
- Backend runs as a long-running Node process (never serverless), frontend as a static build, single production environment, no staging — no deploy changes are expected for this epic's stories, but nothing here should break that envelope.

## UX & Interaction Patterns

- Carta component: car photo dominates ~58% of card height, edge-to-edge with no internal padding inside the card's thick frame; country flag badge sits top-left over the photo (small, rounded-full, with country name as alt text/tooltip — not just the icon); Group/Letter badge sits top-right over the photo. The Super Trunfo card additionally gets a gold border and starburst seal. The original spec had no model name on the card — Epic 5 revises that: the name now goes between the photo and the first attribute row.
- Chip de Resultado: a starburst/seal shape (not a generic pill), white card-paper background, thick border in semantic color (green/amber/red), with text always present ("Você venceu", "Empate — Funil", "Eliminado") — color is never the sole carrier of meaning. Story 5.1 addresses only its positioning/visibility, not its visual design.
- Mobile-first layout: the table stacks vertically (player's own card fixed at the bottom, thumb zone; opponents' cards smaller at top; reveal/Funil area in the middle) as the base layout, scaling up to a more spatial arrangement on desktop.
- Accessibility floor: visible focus on Tab, no result information conveyed by color alone, dark ink text on light surfaces for contrast.

## Cross-Story Dependencies

- Stories 5.4 (photos), 5.5 (Super Trunfo swap), 5.6 (decimal precision), and 5.7 (car name) all touch the same `docs/carros_specs.csv` → `baralho.ts` → `Carta.ts` → frontend `Carta` pipeline — changes to the CSV schema or loader should be made compatibly across these stories rather than in isolation.
- Story 5.4 has an unresolved "Ask First" (image source/licensing) that should be settled before implementation touches the CSV's new `Imagem` column or commits any binary assets.
