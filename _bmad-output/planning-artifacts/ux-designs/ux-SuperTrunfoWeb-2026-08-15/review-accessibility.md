# Accessibility Review — DESIGN.md / EXPERIENCE.md (Super Trunfo Web)

**Scope:** Practical playability review for a hobby multiplayer game meant to be played by family, including possibly older relatives. Not a full WCAG audit.

## Verdict

The core reading surface (dark ink on cream card paper) is genuinely high-contrast and fine, but several **game-critical signals fail basic contrast or rely on color alone** — the win-round banner text, the eliminated-player marker, and the primary CTA/selected-attribute button all measure well under WCAG's minimum thresholds — and the document's own accessibility promise (keyboard nav) is not backed up anywhere else in the spec. These are fixable with small, concrete changes before mockup.

## Findings

### 1. [CRITICAL] Victory-round accent color is nearly invisible on the felt
**Location:** DESIGN.md `colors.win-green` (#2E7D45) used as "acento textual" over `colors.table-felt` (#1B4D3E); DESIGN.md Componentes → Banner de Vitória / Confete ("sobreposição sobre o feltro").
Computed contrast ratio ≈ **1.9:1** (WCAG minimum for any text is 3:1 large / 4.5:1 normal). Green-on-dark-green text will be very hard to read at exactly the moment the game is telling someone they won.
**Fix:** Put the win text on a light chip (card-paper background) rather than directly on felt, or lighten the green substantially and add a white/cream outline or drop shadow for the felt case.

### 2. [CRITICAL] "Eliminated" state is red-on-green and effectively invisible, with no non-color backup
**Location:** EXPERIENCE.md Padrões de Estado → "Jogador eliminado": *"assento marcado como eliminated-red"* (`#A3392B` on `table-felt` `#1B4D3E`).
Computed contrast ratio ≈ **1.46:1** — essentially unreadable. It's also a straight red/green pairing, the single most common color-vision-deficiency confusion (affects ~8% of men). The spec text mentions no accompanying icon, label, or pattern — a real risk that "you're out" is communicated by color alone, and a color that a chunk of players literally cannot distinguish from "not eliminated."
**Fix:** Raise contrast against felt (darker felt-shadow tone or a brighter red), and add a non-color cue: "Eliminado" text label, a grayed-out/desaturated avatar, or an X icon on the seat.

### 3. [HIGH] Accessibility floor contradicts the interaction spec on keyboard support
**Location:** EXPERIENCE.md "Piso de Acessibilidade" ("navegável por teclado (Tab + Enter)") vs. "Primitivas de Interação" ("**Clique é a única modalidade de entrada considerada**... toque em mobile herda o mesmo padrão").
No Component Pattern or State Pattern section describes keyboard focus order, what Enter/Space does on a Linha de Atributo, or whether "Iniciar," room-creation fields, or the victory banner are keyboard-reachable at all. The accessibility floor is an unsupported promise, not a spec.
**Fix:** Either add keyboard behavior as a real primitive (focus order across attribute rows, Enter/Space triggers the same handler as click, standard tab-stops for all buttons/inputs) or soften the floor's claim so it doesn't overstate what's actually specified.

### 4. [HIGH] Primary button and selected-attribute highlight fail contrast
**Location:** DESIGN.md `components.botao-primario` and `components.linha-atributo-selecionada` — both use `card-paper` (#F6F1E4) text on `accent-orange` (#E07A2C).
Computed contrast ratio ≈ **2.5:1**, well under the 3:1 (large text) / 4.5:1 (normal text) minimums. This hits two of the most-used interactive elements: the "create/confirm" CTA and the highlighted row a player just tapped to choose an attribute. The gold Super Trunfo header band with the same light text is even worse (≈2.3:1). Glare on a phone screen outdoors will make this worse still.
**Fix:** Darken the orange used behind text (accent-orange-pressed, ≈3.9:1, is closer but still short of 4.5:1 for small text), or flip to dark ink text on the orange background, or add a bold dark outline/shadow to the light text.

### 5. [MEDIUM] Touch target size is asserted but unspecified, and works against the stated "dense" layout
**Location:** EXPERIENCE.md Responsivo & Plataforma ("toques grandes o suficiente para dedo, não cursor" — no number given) vs. DESIGN.md Layout & Espaçamento (Linha de Atributo rows use `spacing.2`/`spacing.3` = 8–12px, explicitly to "echo the informational density" of the physical card).
Linha de Atributo is the actual tap target for choosing an attribute on your turn. A real Super Trunfo card has 7–10 attribute rows; packed into a mobile card at 8–12px gaps, individual row height risks landing well under the ~44px minimum usually recommended for reliable finger/thumb targeting — a real problem for an older relative with less precise motor control.
**Fix:** Set an explicit minimum tap-target height (e.g. 44px) for Linha de Atributo independent of its visual density — pad the hit area beyond the visible divider line rather than shrinking the row.

### 6. [MEDIUM] Super Trunfo card is distinguished from a regular card mainly by hue (orange vs. gold)
**Location:** DESIGN.md `components.carta-super-trunfo` (gold header band + gold border) vs. `components.carta` (orange header band).
`#E07A2C` and `#C9971F` are adjacent warm hues; for players with red-green or general color-vision deficiency, or at a glance during a fast card-flip animation, this may not read as clearly distinct — and no textual/iconic backup (e.g. a "SUPER TRUNFO" label, star icon) is specified beyond color + a slightly thicker border.
**Fix:** Add a small non-color marker (label text or icon) to the Super Trunfo header band so the flag doesn't depend on hue discrimination alone.

### 7. [LOW] Tie-amber contrast is borderline
**Location:** DESIGN.md `colors.tie-amber` (#B8860B), used for the Funil/tie state.
Computed contrast is ≈2.9–3.0:1 against both felt and card-paper — right at (or just under) the large-text/graphical-object minimum. Acceptable for a large icon fill, marginal if ever used for text.
**Fix:** If tie-amber is ever used for text (not just a fill/icon), nudge it darker or pair with a text label as already planned for other states.

### 8. [LOW] No mention of text resizing or alt text for icon-only info
**Location:** Document-wide; `components.badge-pais` (country flag icon) has no stated text alternative, and there's no note on supporting browser zoom/text-resize for players who need larger text.
Reasonable to skip formal treatment given hobby scope, but worth one line acknowledging it (e.g. flags should have a `title`/`alt` with the country name; layout shouldn't break under 200% zoom).

## Not flagged (checked, found fine)
- Ink-primary/ink-secondary text on card-paper: contrast is genuinely strong (≈6.7:1+), the "high contrast by construction" claim holds for the main reading surface.
- `prefers-reduced-motion` handling for confetti/flip/flying-cards is explicitly specified and adequate.
- "Your turn" indication has a text backup ("Aguardando [nome] escolher…"), not color-only — good.
- Round-winner announcement names the winner in text, not color-only — good.
