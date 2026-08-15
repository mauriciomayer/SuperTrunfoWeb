# Reconciliação: requisitos_super_trunfo.md → prd.md

**Verdict: Minor gaps.** Todos os 22 FRs e 4 RNFs do PRD rastreiam de volta a um item do source; nenhum comportamento, exceção ou limiar numérico foi contradito. Os itens abaixo são desvios pontuais, não perda estrutural.

## 1. Itens do source ausentes, enfraquecidos ou alterados

| Item fonte | Onde vai no PRD | Discrepância |
|---|---|---|
| RF01.6 — "sistema deve usar modelos de carros... de determinados países" | Só aparece em prosa (§4.1 descrição: "tema é carros de determinados países"; Glossário "Grupo") | É o único dos 24 sub-requisitos (RF01.1–RF06.2) que não recebeu um FR numerado com "Consequências (testáveis)" como os demais. O conteúdo está presente, mas não como requisito testável formal — gap de forma, não de conteúdo. |
| RNF02 — "backend deve suportar conexões WebSocket simultâneas..." (sem qualificador de escala) | RNF-2 | PRD acrescenta "dimensionado para o uso real (família/amigos), não para escala pública (ver SM-C1)". O source não traz esse teto de ambição — é uma decisão de produto do PM, declarada e justificada (SM-C1), mas estreita o requisito original sem marcá-la como `[ASSUMPTION]` como fez em outros pontos (§8.3, §9). |
| RNF04 — "interface deve ser adaptável para funcionar **perfeitamente** em dispositivos móveis e desktops" | RNF-4 | Palavra trocada para "funcionar **bem**" — suaviza a barra de aceitação (perfeitamente → bem) sem qualquer nota de que é uma simplificação intencional. |
| RF03.4 — winner = maior valor "(ou menor valor, caso o atributo seja inversamente proporcional, como 'Aceleração 0-100 km/h')" — um exemplo, não uma lista fechada | FR-12 | PRD reformula como "Atributos inversos (**lista fixa**, ex: Aceleração 0-100 km/h)" — introduz o conceito de uma lista fixa/fechada de atributos inversos que o source não define nem menciona. É uma inferência plausível de implementação, mas não está no source e não foi sinalizada como suposição (diferente do tratamento dado a FR-7/RF02.3, que foi corretamente marcado como aberto em §8.3/§9). |

Nenhum limiar numérico (32 cartas, 8 grupos de 4, 2–4 jogadores, 3 vagas de IA, 1,5s de RNF01/RNF-1) foi alterado. A ambiguidade original do RF02.3 (regra de sobra na distribuição não especificada) foi preservada fielmente e corretamente marcada como questão aberta em vez de ser resolvida silenciosamente — bom sinal de fidelidade, não um gap.

## 2. Adições do PRD sem base no source (razoáveis, mas fora do documento de requisitos)

Tudo abaixo é esperado de um PRD e vem atribuído a outros artefatos (brief, pesquisa de mercado) — nada parece fabricado, mas nenhum tem lastro no `requisitos_super_trunfo.md`:

- Visão, JTBD, não-usuários, jornadas de usuário (UJ-1, UJ-2) — §1, §2
- Glossário — §3 (útil, consistente com o source, sem conteúdo novo relevante)
- Não-Metas explícitas (§5): temas alternativos, contas persistentes, matchmaking, monetização, licenciamento de marca, app nativo — nenhum desses é mencionado ou negado no source
- Métricas de sucesso SM-1, SM-2, SM-C1 (§7)
- Questões em Aberto e Índice de Suposições (§8, §9) — meta-conteúdo sobre o próprio PRD, não requisitos
- A afirmação de mercado em §1 ("nenhuma versão digital ativa do Super Trunfo... existe hoje") — não verificável contra este source (é atribuída à pesquisa de mercado separada, fora do escopo desta auditoria)

Nada nessa lista contradiz o source; é enquadramento de produto adicionado sobre uma base de requisitos preservada.
