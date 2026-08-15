---
title: 'Reconciliation: PRD vs Brief'
created: '2026-08-15'
---

# Reconciliation Audit — PRD vs Brief (Super Trunfo Web)

**Verdict: Faithful, with minor gaps.** All four explicit scope boundaries (no other deck themes, no persistent accounts, no matchmaking with strangers, no monetization) and the brand-risk decision are carried forward correctly and without narrowing or widening. The gaps below are omissions/additions worth a second look, not contradictions of brief decisions.

## 1. Brief decisions missing, contradicted, or drifted in the PRD

- **Secondary audience dropped.** Brief §"Quem Isso Atende" explicitly registers a secondary audience (Brazilian adults 30-44 who played physical Super Trunfo as kids, tagged `[SUPOSIÇÃO]`, "not pursued now, plausible direction if the project grows"). PRD §2 (Público-Alvo) contains only JTBDs and non-users for v1; the secondary-audience note is not carried forward anywhere in the PRD. Not a contradiction (it's a "not pursued" item), but the brief clearly wanted it *registered* for future reference, and the PRD is the natural place to preserve that — it's currently only findable by re-reading the brief.

- **"Learning delivered" success criterion missing from §7.** Brief §"Critérios de Sucesso" names three success conditions for v1: (1) game works end-to-end with correct rules, (2) fun enough for family/friends to really play, (3) the build process delivers the technical learning sought (real-time architecture, WebSocket, game logic). PRD §7 has SM-1 (maps to #1) and SM-2 (maps to #2), but no metric maps to #3. The learning goal surfaces only as a JTBD in §2.1, not as a success metric, even though the brief listed it as a co-equal success condition alongside the other two.

- **SM-2 adds a "repeat play" bar not in the brief.** Brief's fun criterion is "é divertido o suficiente para família e amigos jogarem de verdade" (fun enough that they actually play for real). PRD's SM-2 is "família e amigos topam jogar mais de uma vez" (willing to play more than once) — a stronger, more specific bar (repeat play) than the brief stated. Minor drift, not flagged as an error but worth the PM's attention since §7 claims these metrics are "herdadas do brief" (inherited from the brief) when SM-2 has been tightened.

- **Title footnote softens the brand-name decision.** PRD header reads: "*Working title — confirma o nome mais tarde, ver §8 sobre a marca.*" The brief's actual decision was firm and conditional: keep the "Super Trunfo" name as-is while the project stays personal, revisit (licensing or rebrand) only if it grows beyond family/friends — not "decide the name later." PRD §8.2 itself restates the brief's decision correctly ("decisão consciente do usuário de adiar"), so this is a framing inconsistency between the header and §8.2 rather than a substantive contradiction — but the header's wording could read as if the name itself is still undecided, which the brief did not leave open.

## 2. Additions beyond the brief (not necessarily wrong, just new)

- **New trademark risk: real car manufacturer brands/models.** PRD §4.1 Notes introduces a brand-risk question the brief never raises — use of real car manufacturer names/models in `docs/carros_specs.csv` carries its own trademark exposure, distinct from the "Super Trunfo" name issue. The PRD applies the same posture (treat as internal use for now, revisit only if the project becomes a product) by analogy to the brief's existing decision, but this is a PM-introduced extension of brand risk, not something the brief evaluated or decided. Worth flagging to the user since it's a new legal-exposure surface, even if the interim posture is reasonable.

- **New non-goal: no native mobile app.** PRD §5 adds "Não vamos construir um app nativo mobile — só web responsivo," which is not in the brief's explicit out-of-scope list. It's consistent with the brief's Solution section ("Acessível por navegador, sem instalação") and doesn't contradict anything, but it is a PRD-only addition that makes an implicit brief assumption explicit.

- **New counter-metric (SM-C1): explicitly not investing in scale infrastructure.** PRD §7 adds a "contra-métrica" instructing not to over-invest in scaling beyond a few simultaneous matches among acquaintances. This has no direct counterpart in the brief, though it's a reasonable operationalization of the brief's "no formal goals / passion project" stance and ties into RNF-2. Flagged as new scope-guidance content, not a conflict.

- **Assumption tag dropped for "no persistent accounts."** Brief marks the persistent-accounts exclusion with `[SUPOSIÇÃO]` (not directly discussed, assumed out of scope). PRD §5/§6.2 states it as a plain non-goal without the assumption caveat. This is the PM formalizing an assumption into a decision — reasonable for a PRD, but worth noting that the underlying uncertainty flagged in the brief isn't visibly preserved.
