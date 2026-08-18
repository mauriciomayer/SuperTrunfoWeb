---
title: 'Bandeiras de País como Imagem Real'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '8d2222dae50cffba45702867c715e9903e97d471'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A bandeira do país em cada Carta (`Carta.tsx`, `BANDEIRAS_POR_PAIS`) é um emoji de bandeira (🇮🇹, 🇩🇪, etc.). Windows não renderiza esses emoji corretamente -- mostra o código de duas letras dentro de uma caixa (ex: "IT" em vez da bandeira da Itália) em vez do glifo de bandeira de verdade. macOS e Android renderizam normalmente.

**Approach:** Trocar o emoji por um asset de imagem real (SVG) por país, auto-hospedado no repositório (`frontend/src/assets/bandeiras/`, nunca CDN externo em runtime), renderizando idêntico em qualquer sistema operacional. `docs/carros_specs.csv` continua a fonte de dados do país de cada Carta (coluna "Pais") -- só a representação visual muda, o dado (`carta.pais`, string) é o mesmo de sempre.

## Boundaries & Constraints

**Always:**
- Exatamente 5 bandeiras precisam existir como asset SVG, cobrindo os 5 países hoje presentes em `docs/carros_specs.csv`: Alemanha, Reino Unido, Itália, França, Estados Unidos (mesmas chaves de `BANDEIRAS_POR_PAIS` hoje).
- As bandeiras precisam ser SVGs de fonte confiável e licença permissiva (ex: pacote `flag-icons`, MIT), copiados/commitados como arquivo próprio no repositório -- nunca carregados via CDN externo em runtime, nunca dependência de fonte de emoji do sistema operacional.
- O badge do país continua no canto superior esquerdo da foto, mesmo tamanho/posição visual aproximada de hoje, com o nome do país continuando acessível via `title`/`aria-label` (como já é hoje).
- Fallback existente (`?? "🌍"` pra país não mapeado) precisa continuar funcionando de alguma forma -- se não houver SVG genérico "mundo" equivalente, decidir o comportamento razoável (ex: manter o emoji 🌍 só nesse caso residual, já que não há Carta real sem país mapeado hoje).

**Ask First:**
- Nenhuma decisão nesta história depende de aprovação humana durante a execução -- bandeira nacional é símbolo de domínio público, sem a mesma pendência de licenciamento que fotos de carro (Story 5.4).

**Never:**
- Nenhuma mudança em `docs/carros_specs.csv` nem em `backend/` -- o campo `pais` continua uma string igual a hoje, só a renderização no frontend muda.
- Nenhuma mudança na Story 5.1 (Chip de Resultado overlay) nem em qualquer outro elemento visual da Carta fora do badge de país (foto do carro, badge Grupo/Letra, nome do carro, moldura Super Trunfo).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Carta de país mapeado | `carta.pais` é um dos 5 países presentes no Baralho | Badge mostra o SVG da bandeira real, idêntico em qualquer SO | N/A |
| País não mapeado (residual) | `carta.pais` não bate com nenhuma das 5 chaves (não deveria acontecer com o Baralho real de 32 Cartas) | Fallback existente continua funcionando (comportamento razoável, sem crash) | N/A |
| Acessibilidade preservada | Qualquer Carta renderizada | O nome do país continua disponível via `title`/`aria-label` no badge, igual a hoje | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/components/Carta.tsx:57-64` -- `BANDEIRAS_POR_PAIS: Record<string, string>` (hoje emoji) vira um mapa de imports de imagem (ex: `Record<string, string>` de paths/URLs resolvidos pelo Vite, ou `Record<string, ReactNode>` renderizando `<img>`) -- decisão de tipo/estrutura fica a critério de quem implementa, mantendo o uso no JSX (`carta-frente__badge-pais`) o mais próximo possível do atual
- `frontend/src/components/Carta.tsx:150-157` -- `<span className="carta-frente__badge-pais" title={carta.pais} aria-label={carta.pais}>{bandeira}</span>` -- `bandeira` deixa de ser um caractere emoji, vira renderização de imagem (`<img>` com `alt=""` já que `title`/`aria-label` do container cobre a semântica, ou inline SVG)
- `frontend/src/components/Carta.css:65-75` -- `.carta-frente__badge-pais` tinha `font-size: 15px` dimensionando o emoji via texto; precisa de dimensão explícita nova (`width`/`height`) pro `<img>`/SVG substituto, mantendo o footprint visual aproximado do badge atual (canto superior esquerdo, fundo `--papel-carta`, `border-radius: var(--raio-full)`)
- `frontend/src/assets/bandeiras/` (novo diretório) -- 5 arquivos SVG (Alemanha, Reino Unido, Itália, França, Estados Unidos), fonte sugerida: pacote `flag-icons` (MIT) via `npm install`, copiando só os 5 SVGs necessários pro repositório (self-hosted, sem manter o pacote como dependência de runtime se não for necessário)

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/assets/bandeiras/` -- 5 arquivos SVG de bandeira (Alemanha, Reino Unido, Itália, França, Estados Unidos), de fonte licenciada permissivamente, commitados no repositório
- [x] `frontend/src/components/Carta.tsx` -- `BANDEIRAS_POR_PAIS` passa a resolver pra imagem real (import de cada SVG); badge renderiza a imagem no lugar do emoji, preservando `title`/`aria-label` com o nome do país
- [x] `frontend/src/components/Carta.css` -- `.carta-frente__badge-pais` ganha dimensão explícita compatível com `<img>`/SVG, mantendo posição/footprint visual do badge
- [x] Teste de componente (`Carta.test.tsx`) -- confirma que cada um dos 5 países mapeados renderiza o asset de imagem esperado (não mais um caractere emoji); confirma que o fallback pra país não mapeado continua funcionando
- [x] (achado da revisão -- verification-gap, demonstrado na prática) Nenhum teste validava o CONTEÚDO real dos 5 SVGs -- a asserção original só comparava o `src` do `<img>` contra o mesmo import que o próprio componente usa, nunca os bytes reais em disco. Reviewer corrompeu propositalmente um dos arquivos e a suite inteira continuou verde. Novo teste lê cada um dos 5 arquivos direto do disco (`readFileSync`) e confere conteúdo SVG minimamente válido -- verificado que esse teste de fato falha se um arquivo for corrompido
- [x] (achado da revisão) `frontend/src/assets/bandeiras/LICENSE` -- texto MIT completo do pacote `flag-icons` (versão 7.5.0), copyright do autor original, e mapeamento de qual arquivo de origem virou qual arquivo commitado -- comentário no código não bastava pra cumprir a licença MIT de verdade
- [x] (achado da revisão) `<img>` ganhou `width`/`height` HTML explícitos (além do CSS) -- proteção nativa do navegador contra layout shift; `console.warn` no fallback residual (mesmo padrão "falha cedo e alto" do backend); sizing dedicado pro emoji de fallback (que perdeu o `font-size` do badge pai)

**Acceptance Criteria:**
- Given uma Carta de qualquer país presente em `docs/carros_specs.csv`, when a Carta é renderizada, then a bandeira aparece como asset de imagem real (SVG), nunca como emoji de bandeira do sistema operacional
- Given a mesma Carta renderizada em Windows, macOS ou Android, when a bandeira aparece, then o resultado é visualmente idêntico nos três

## Design Notes

O badge hoje usa `font-size: 15px` porque o emoji é texto -- a troca pra `<img>`/SVG precisa de `width`/`height` explícitos em vez disso; um bom ponto de partida é medir a caixa real do emoji renderizado hoje (aprox. 15-18px de lado) e replicar essa proporção, mas o ajuste fino de pixel é decisão de quem implementa.

`flag-icons` (npm, MIT) é sugestão de fonte, não obrigação -- qualquer fonte de SVG de bandeira nacional com licença permissiva e proporção/cores precisas serve; o importante é a imagem ser precisa (não uma versão simplificada/estilizada que destoe da bandeira real) e a licença permitir uso livre num repositório público.

**Correção pós-aprovação (revisão):** a Acceptance Criteria #2 ("visualmente idêntico em Windows/macOS/Android") não é comprovável por nenhum teste automatizado deste projeto -- `jsdom` (testes de componente) nunca rasteriza fonte/glifo, e o Playwright só roda Chromium, sem ferramenta de regressão visual. Isso já era esperado (por isso a Verification original só listava checagem manual) e não é uma lacuna real: um `<img>` apontando pra um SVG autocontido não tem nenhum caminho de renderização dependente de SO (ao contrário do emoji, cujo bug de origem era exatamente depender da fonte de emoji instalada no sistema) -- confirmado que nenhum dos 5 SVGs referencia fonte de sistema/CDN externo.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd frontend && npm test` -- 121/121 verde (13 arquivos)
- `npx tsc -b` -- limpo
- `npx playwright test --workers=1` (raiz) -- 10/10 verde
- Sanity check da revisão: um dos 5 SVGs foi corrompido propositalmente pra confirmar que o novo teste de conteúdo (achado acima) realmente falha nesse cenário -- confirmado, depois restaurado e reconferido idêntico ao original
- `git status` conferido -- `frontend/package.json`/`package-lock.json` inalterados (pacote `flag-icons` nunca ficou como dependência de runtime)

**Manual checks (if no CLI):**
- Abrir a Mesa de Jogo (ou a tela de qualquer Carta visível) num navegador Windows e confirmar visualmente que a bandeira aparece como imagem de verdade, não como o código de duas letras numa caixa.

## Suggested Review Order

1. [Carta.tsx:89](../../frontend/src/components/Carta.tsx#L89) -- `renderizarFallbackBandeira`, o `console.warn` defensivo (achado da revisão)
2. [Carta.tsx:187](../../frontend/src/components/Carta.tsx#L187) -- o badge renderizando `<img>` com `width`/`height` explícitos, ou o fallback
3. [Carta.css:83](../../frontend/src/components/Carta.css#L83) e [Carta.css:101](../../frontend/src/components/Carta.css#L101) -- `.carta-frente__bandeira-img` (com o comentário explicando por que o `border-radius` ficou hardcoded) e `.carta-frente__bandeira-fallback` (achado da revisão)
4. [assets/bandeiras/LICENSE](../../frontend/src/assets/bandeiras/LICENSE) -- atribuição MIT completa do `flag-icons` (achado da revisão)
5. [Carta.test.tsx](../../frontend/src/components/Carta.test.tsx) -- descreve "Story 5.2", especialmente o bloco que lê os 5 SVGs do disco (achado da revisão, o mais importante)
