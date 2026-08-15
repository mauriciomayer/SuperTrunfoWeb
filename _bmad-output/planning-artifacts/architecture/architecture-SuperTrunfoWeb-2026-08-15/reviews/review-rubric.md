# Rubric Review — ARCHITECTURE-SPINE.md (Super Trunfo Web)

**Reviewer:** independent rubric-walking review (hobby-stakes calibration)
**Target:** `_bmad-output/planning-artifacts/architecture/architecture-SuperTrunfoWeb-2026-08-15/ARCHITECTURE-SPINE.md`
**Inputs cross-checked:** `prds/prd-SuperTrunfoWeb-2026-08-14/prd.md`, `ux-designs/ux-SuperTrunfoWeb-2026-08-15/EXPERIENCE.md`

## Overall Verdict

The spine correctly and enforceably resolves every *game-logic* divergence point (authoritative state, one Room per match, server-side card filtering, in-process AI, an explicit state machine, the leftover-card rule, inverse-attribute data, the A-card tie-break, and reconnection *timing*), but it silently leaves the whole operational/deployment envelope undecided and stops short on two networking-identity mechanisms (private room joining, reconnection authentication) that two implementers could resolve incompatibly — one of which risks directly contradicting the PRD's "no strangers" non-goal.

---

## Findings

### CRITICAL — Deployment/hosting/environment envelope is completely unaddressed
**Location:** whole document (absent from both `## Deferred` and the Stack/Consistency Conventions sections).

The PRD's own driving JTBD is people "à distância, sem precisar estar todos juntos fisicamente ou na mesma rede" (UJ-1) — i.e., this must work over the real internet, not just localhost. Yet the spine never states: where the backend runs, whether frontend and backend are one deployed unit or two, how the client resolves the Colyseus WS URL in production vs. dev, or whether HTTPS/WSS is assumed. The "Config" row in Consistency Conventions only says "use `.env`/`import.meta.env`, never hardcoded" — that's a coding convention, not a deployment decision. Two implementers (or the same implementer at two different times) could trivially build a frontend that only ever points at `ws://localhost:2567` and a backend that assumes it's reverse-proxied, and the two halves would simply never connect once deployed. This is exactly the "operational/environmental envelope" the rubric asks to verify is covered, not just gestured at — here it isn't gestured at all.

**Fix:** Add either an AD or, at minimum, an explicit `## Deferred` entry with a stated interim default, e.g.: "Single Node process serves both the built frontend static assets and the Colyseus WS endpoint on one port; no separate frontend host in v1. Revisit if a CDN/static host is wanted later." Even a one-line placeholder prevents silent divergence.

---

### HIGH — Room-joining mechanism underspecified; risks violating the PRD's "no strangers" non-goal
**Location:** AD-2 ("Entrar na Sala = entrar nela via matchmaking do Colyseus"), line ~49.

The UX flow requires a specific, private "link de convite" that routes a specific set of invitees into *one specific* match (Fluxo 1, Fluxo 2). Colyseus's default `joinOrCreate(roomName, options)` matchmaking pools *any* client requesting that room type into *any* available instance with matching filters — it does not, by itself, guarantee a client lands in one particular host's room. AD-2's rule doesn't specify whether the invite link encodes the room's `roomId` and the client uses `client.joinById(roomId)`, versus a generic `joinOrCreate` call. If one implementer uses `joinById` (correct — private, matches the UX) and another uses `joinOrCreate` by room name (which could match an unrelated waiting room), the result is either a broken invite link or, worse, a stranger joining someone else's game — directly contradicting PRD §5: "Não vamos oferecer matchmaking com Jogadores desconhecidos."

**Fix:** Extend AD-2's Rule: "O link de convite carrega o `roomId` da instância criada; o cliente entra via `client.joinById(roomId)` — nunca `joinOrCreate` genérico, que poderia casar com uma sala de outro grupo."

---

### HIGH — Reconnection *mechanism* (player identity/authentication) left undecided, despite being explicitly delegated to Architecture
**Location:** AD-9, lines 103–108; compare UX `EXPERIENCE.md` → "Padrões de Estado" → "Reconexão" (line 81) and PRD §8.6.

AD-9 fixes *when* control returns to a reconnecting human (start of next round) but not *how* the server recognizes that the reconnecting client is the same original player rather than a new client that simply typed the same name. This matters because there's no login (PRD: "identificação é só o nome digitado") — without a defined mechanism, one implementer might use Colyseus's built-in `allowReconnection`/reconnection-token flow (secure: token stored client-side, tied to the original session), while another might re-match by comparing the typed name string (insecure: anyone typing "Mauricio" again could hijack the AI-controlled seat). The UX doc explicitly hands this exact decision to Architecture: *"Vale confirmar com o usuário ou deixar para a Arquitetura decidir o mecanismo exato."* AD-9 answers the timing half of that ask but not the mechanism half.

**Fix:** Extend AD-9 (or add AD-11): "A reconexão usa o mecanismo nativo do Colyseus (`allowReconnection` no `onLeave` + `reconnectionToken` guardado no cliente, ex: `sessionStorage`); jamais reautenticar por comparação do nome digitado."

---

### MEDIUM — AD-8's tie-break rule depends on an undefined concept ("seat order")
**Location:** AD-8, lines 97–101.

AD-8's rule is "vence quem estiver mais próximo do Jogador que acionou o Super Trunfo na ordem de turno (sentido dos assentos)." Nothing elsewhere in the spine defines how seat order/"sentido dos assentos" is established (join order at room creation? a fixed seat index in the schema?) or that it's a stable, exposed property of `EstadoPartida`. Since round order in this game is winner-goes-next (FR-14), not a fixed rotation, "seat order" is a distinct concept from "turn order" and needs its own definition to make AD-8 actually enforceable as written — right now two implementers could pick different tie-break orderings and both claim to satisfy the rule.

**Fix:** Add one line defining seat order explicitly, e.g. "Assentos são numerados na ordem em que os Jogadores entraram na Sala (`Jogador.seatIndex`), fixa pelo resto da Partida" — and reference that field name from AD-8.

---

### LOW — Inconsistent confidence-tagging between two similarly-delegated decisions
**Location:** AD-8 (`[SUPOSIÇÃO — não confirmada com o usuário]`) vs. AD-9 (`[ADOPTED via UX]`).

Both the A-card tie-break (PRD §8.5) and the reconnection-timing rule (PRD §8.6) are open questions the PRD explicitly hands to Architecture with equivalent authority to decide ("fica para Arquitetura/Épicos definir..." / "...ou para a Arquitetura assumir como padrão de implementação"). The spine treats them very differently — AD-8 is flagged as an unconfirmed assumption to revisit with the user before implementing FR-17, while AD-9 is presented as settled ("ADOPTED"). This may be a deliberate judgment call (AD-8 changes who wins a round; AD-9 doesn't), but as written it isn't explained, and a reader could reasonably wonder why one delegated decision needs a user check-in and the identical-shaped other doesn't.

**Fix:** One clause in AD-9 noting why it's treated as settled (e.g., "UX already proposed and reasoned through this; unlike AD-8 it doesn't change a match outcome, so no user check-in gate is set before implementing").

---

### LOW — "Config" convention row is implementation-detail-level, borderline bloat
**Location:** Consistency Conventions table, "Config" row.

"Porta do servidor e variáveis de ambiente via `.env`... nunca hardcoded" is a generic coding-hygiene rule rather than something that gates a real cross-system compatibility choice — nothing about *how* frontend and backend actually find each other in a given environment is decided (see the Critical finding above). It's correctly scoped down into the lower-stakes "Conventions" table rather than presented as an AD, so this is a minor observation, not a real defect.

**Fix:** Optional — either fold this row into the deployment fix above (once that exists, this becomes a natural corollary) or leave as-is; not blocking.

---

## Rubric Item Checkpoints Not Otherwise Covered Above

- **Item 4 (version sanity):** Node 24 LTS, TypeScript 5.7+, Colyseus 0.17.x (server + client SDK explicitly paired), React 19.2.x, Vite 8.x — no internally inconsistent pairing found (e.g., no Node version too old for Vite 8, no client/server Colyseus version mismatch). Plausible as a snapshot for August 2026; not independently re-verified against release calendars per instructions.
- **Item 5 (ratifies vs. contradicts PRD/UX):** Sampled AD-2 (Room lifecycle vs. UX Arquitetura de Informação), AD-3 (card visibility vs. UX "Carta (verso)" and RNF-3), AD-6/AD-7 (vs. PRD §8.3/§8.4 open questions), AD-9 (vs. UX "Reconexão" and PRD §8.6) — all ratify rather than contradict, aside from the mechanism gap noted in the HIGH finding above (which is an omission, not a contradiction).
- **Item 7 (bloat):** No AD found that's really an unenforceable "seed" masquerading as an invariant — every AD gates a real, plausible fork point two implementers could take differently. See the two LOW findings for the closest borderline cases.
