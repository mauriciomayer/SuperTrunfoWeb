---
title: 'Fotos Reais dos Carros'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
baseline_commit: '5d595d435894d4d0c11ecbbcaae38d9b52a92f87'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Toda Carta hoje mostra um placeholder (emoji 🚗 + texto "foto em breve", `frontend/src/components/Carta.tsx:209-212`) no lugar da foto do carro -- o jogo não parece "de verdade". O Mauricio já tem as 32 fotos reais localmente, uma por carro do Baralho.

**Approach:** Copiar as 32 fotos de `C:\Users\mauri\Desktop\carros` pro repositório (`frontend/src/assets/carros/`, commitadas no Git -- decisão já confirmada: usar as fotos que já existem, aceitando o risco de licenciamento que motivou a pergunta original), adicionar uma coluna `Imagem` em `docs/carros_specs.csv` apontando pro arquivo de cada carro, e propagar esse campo do CSV até o schema da Carta (`backend/src/schema/Carta.ts`) e até o frontend, substituindo o placeholder pela foto real.

## Boundaries & Constraints

**Always:**
- As 32 fotos de `C:\Users\mauri\Desktop\carros` (nomes de arquivo já batem 1:1 com a coluna `Modelo` do CSV, ex: `Ferrari 812 Superfast.jpg`) são copiadas pra `frontend/src/assets/carros/`, renomeadas pra um slug kebab-case ASCII (ex: `ferrari-812-superfast.jpg`) -- evita espaços/parênteses em caminho de import do Vite. Preservar a extensão original de cada arquivo (a maioria `.jpg`, 4 arquivos são `.jpeg`: `Alpine A110 R`, `Bentley Continental GT V8`, `Dodge Charger King Daytona` -- conferir a lista completa na pasta antes de assumir extensão).
- `docs/carros_specs.csv` ganha a coluna `Imagem` (nova, ao lado de `Modelo`) com o nome do arquivo slugificado (com extensão) de cada carro -- todas as 32 linhas preenchidas, nenhuma vazia.
- `backend/src/schema/Carta.ts` ganha `@type("string") imagem: string = ""`; `backend/src/game/baralho.ts` propaga `registro["Imagem"]` pro campo; `frontend/src/components/Carta.tsx`'s `CartaFrente` ganha `imagem: string` (espelhando o schema, AD-10).
- O placeholder atual (🚗 + "foto em breve") continua existindo como fallback pra quando `carta.imagem` vier vazio -- nunca quebra a tela se o campo não estiver preenchido.
- `backend/src/game/baralho.test.ts`'s `CABECALHO_CSV` (linha 8) precisa ganhar a coluna `Imagem` também -- senão os fixtures de CSV temporário desalinham a contagem de colunas e todo teste que usa `escreverCsvTemporario` quebra.

**Ask First:**
- Nenhuma decisão restante depende de aprovação humana durante a execução -- a origem das fotos já foi decidida (fotos que o Mauricio já tem, sem trocar por fonte alternativa).

**Never:**
- Nenhuma mudança no formato/nome dos outros campos já existentes no CSV, schema ou `CartaFrente` -- só adiciona `Imagem`/`imagem`.
- Nenhuma mudança no nome do carro aparecer na Carta (Story 5.7, separada) -- esta história é só a foto.
- Nenhuma introdução de lib/dependência nova pra manipular imagem (resize, compressão) -- as fotos são copiadas como estão, só renomeadas.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Carta com imagem mapeada | `carta.imagem` é um dos 32 arquivos copiados | A foto real do carro aparece no lugar do placeholder, em qualquer estado de revelação (própria ou de oponente) | N/A |
| `imagem` vazio (residual) | `carta.imagem === ""` (não deveria acontecer com o Baralho real de 32 Cartas) | Fallback do placeholder atual (🚗 + "foto em breve") continua funcionando, sem crash | N/A |
| Baralho carregado do CSV real | `carregarBaralho()` sem argumento (CSV real do repo) | Todas as 32 Cartas têm `imagem` não-vazio após o carregamento | Validação de "32 Cartas" e "1 Super Trunfo" já existentes continuam passando |

</frozen-after-approval>

## Code Map

- `C:\Users\mauri\Desktop\carros` (fonte externa, fora do repo) -- 32 arquivos de foto, nomes batendo 1:1 com `Modelo` do CSV (`ls` confirma: 32 arquivos, ~8.18 MB total, maior arquivo 1.47 MB -- tamanho tranquilo pra commitar). 4 arquivos são `.jpeg` (resto `.jpg`) -- conferir a extensão real de cada um ao copiar, não assumir `.jpg` pra todos.
- `docs/carros_specs.csv` -- cabeçalho `ID,Grupo,Letra,SuperTrunfo,Modelo,Pais,...`; `Modelo` já existe mas não é lido por `baralho.ts` hoje. Nova coluna `Imagem` entra ao lado de `Modelo`, uma linha por Carta.
- `backend/src/game/baralho.ts:69-82` -- dentro do `.map` que constrói cada `Carta`, adicionar `carta.imagem = registro["Imagem"];` junto dos outros campos. `parsearLinha` (linha 27, `split(",")` simples) continua funcionando desde que os nomes de arquivo slugificados não tenham vírgula (não vão ter).
- `backend/src/schema/Carta.ts:22-38` -- adicionar `@type("string") imagem: string = "";` junto aos outros campos `string` (ex: ao lado de `pais`).
- `backend/src/game/baralho.test.ts:7-8` -- `CABECALHO_CSV` precisa incluir `Imagem` na lista de colunas, senão os testes que escrevem CSV fixture (`escreverCsvTemporario`) desalinham a contagem esperada de colunas e quebram com o erro de "linha X tem Y colunas, esperado Z".
- `frontend/src/components/Carta.tsx:12-25` (`CartaFrente`) -- adicionar `imagem: string;`. Linhas 186-213 (`.carta-frente__foto`) -- trocar o placeholder fixo por renderização condicional: `<img>` com a foto real (via asset importado) quando `carta.imagem` mapear pra um arquivo conhecido, placeholder atual como fallback. Com 32 arquivos, `import.meta.glob` (Vite) sobre `../assets/carros/*` é o caminho natural pra montar o mapa nome-de-arquivo → URL sem 32 imports nomeados um a um (decisão de implementação, mas evita repetir o padrão verboso de `BANDEIRAS_POR_PAIS` numa escala 6x maior).
- `frontend/src/components/Carta.css:43-57` (`.carta-frente__foto`, `.carta-frente__foto-placeholder`) -- a nova `<img>` precisa preencher o mesmo espaço (`height: 160px` do container) sem distorcer proporção (`object-fit: cover` é o caminho natural).

## Tasks & Acceptance

**Execution:**
- [x] Copiar as 32 fotos de `C:\Users\mauri\Desktop\carros` pra `frontend/src/assets/carros/`, renomeando cada uma pra slug kebab-case ASCII com a extensão original preservada
- [x] `docs/carros_specs.csv` -- adicionar coluna `Imagem` com o nome do arquivo slugificado de cada uma das 32 linhas
- [x] `backend/src/schema/Carta.ts` -- adicionar campo `imagem: string`
- [x] `backend/src/game/baralho.ts` -- propagar `registro["Imagem"]` pro campo `imagem` da Carta
- [x] `backend/src/game/baralho.test.ts` -- atualizar `CABECALHO_CSV` com a coluna `Imagem`; teste novo/atualizado confirmando que todas as 32 Cartas carregadas do CSV real têm `imagem` não-vazio (cobre a Matrix: "Baralho carregado do CSV real")
- [x] `frontend/src/components/Carta.tsx` -- adicionar `imagem` à `CartaFrente`; renderizar a foto real no lugar do placeholder, com fallback pro placeholder atual quando `imagem` vier vazio (cobre a Matrix: "imagem vazio")
- [x] `frontend/src/components/Carta.css` -- estilo da nova `<img>` preenchendo o espaço da foto sem distorcer proporção
- [x] `frontend/src/components/Carta.test.tsx` -- testes cobrindo a Matrix: Carta com imagem mapeada renderiza a foto certa, `imagem` vazio cai no fallback do placeholder atual
- [x] (achado da implementação, fora do Code Map original) `backend/src/rooms/PartidaRoom.ts`'s `clonarCarta` -- copiava campos manualmente e faltava `imagem`; sem o fix, a foto sumiria especificamente durante o estado `Revelando` (violando "em qualquer estado de revelação" da AC), tanto pra própria Carta quanto a do oponente. Reforçado o teste de `clonarCarta` (`PartidaRoom.test.ts`), que antes usava o `""` padrão pra um campo que não setava -- passaria mesmo com o bug
- [x] (achado da revisão -- verification-gap, corroborado por 2 revisores independentes) Nenhum teste cruzava os 32 valores reais de `Imagem` do CSV contra os arquivos de verdade em `frontend/src/assets/carros/` -- um rename/typo futuro de um lado só ficaria invisível (campo continua não-vazio, mas não resolve foto nenhuma). Novo teste em `baralho.test.ts` carrega o Baralho real e confere, Carta por Carta, que `imagem` bate com um arquivo existente no disco
- [x] (achado da revisão, mesmo padrão de `renderizarFallbackBandeira`) `carta.imagem` vazio (residual) e `carta.imagem` preenchido mas sem entrada em `FOTOS_POR_ARQUIVO` (mismatch de verdade) caíam no mesmo fallback sem distinção -- só o segundo é um sinal acionável. Extraído `resolverFotoCarro()` (`Carta.tsx:130`) que separa os dois casos e só avisa (`console.warn`) no segundo, com teste cobrindo o branch antes não testado

**Acceptance Criteria:**
- Given `docs/carros_specs.csv` com a coluna `Imagem` preenchida, when o Baralho é carregado, then o campo de imagem é propagado do CSV até o schema da Carta e até o frontend (FR-28)
- Given uma Carta com imagem definida, when ela é renderizada (própria ou de oponente, em qualquer estado de revelação), then a foto real do carro aparece no lugar do placeholder atual (🚗)

## Design Notes

Slugificação sugerida: minúsculas, espaços e `(`/`)` viram `-`, sem acento (nenhum dos 32 nomes tem acento hoje), múltiplos hífens colapsados -- ex: `"Mercedes-AMG C 63 S (W205)"` → `mercedes-amg-c-63-s-w205.jpg`, `"Lotus Emira (V6)"` → `lotus-emira-v6.jpg`. Exato algoritmo fica a critério de quem implementa, desde que determinístico e sem colisão entre os 32 nomes.

`import.meta.glob("../assets/carros/*", { eager: true })` (ou equivalente) resolve todos os 32 arquivos de uma vez num objeto `{ caminho: modulo }` -- extrair o nome do arquivo de cada chave pra montar o mapa usado no lookup por `carta.imagem`.

## Verification

**Commands (executados de verdade, não só esperados):**
- `cd backend && npm test` -- 67/67 verde (8 arquivos), incluindo `baralho.test.ts` (15 testes) com o CSV real: 32 Cartas com `imagem` preenchido E cruzado contra os arquivos reais em disco
- `cd frontend && npm test` -- 130/130 verde (13 arquivos), `Carta.test.tsx` com 37 testes
- `npx tsc -b` (frontend e backend) -- limpo nos dois
- `npx playwright test --workers=1` (raiz) -- suíte e2e existente continua verde
- `git status`/`git check-ignore` -- confirmado que as 32 fotos NÃO são ignoradas por nenhuma regra de `.gitignore` (precisam ser staged explicitamente no commit, já que `frontend/src/assets/carros/` é diretório novo)
- Verificação manual: dev servers reais + script Playwright descartável confirmaram fotos reais e distintas (Jaguar F-Type R, Ford GT, Hennessey Venom F5) renderizando tanto na própria Carta quanto na do oponente durante a revelação

**Manual checks (if no CLI):**
- Abrir a Mesa de Jogo num navegador e confirmar visualmente que a foto real do carro aparece em pelo menos algumas Cartas diferentes (não só a mesma foto repetida por engano de mapeamento).

## Suggested Review Order

**Pipeline de dados (CSV -> schema -> frontend)**

- Ponto de entrada: `docs/carros_specs.csv` ganha a coluna `Imagem`, uma linha por Carta.
  [`carros_specs.csv:1`](../../docs/carros_specs.csv#L1)

- Propagação no backend: CSV -> campo `imagem` da Carta.
  [`baralho.ts:74`](../../backend/src/game/baralho.ts#L74)

- Schema Colyseus: novo campo sincronizado pra qualquer cliente.
  [`Carta.ts:28`](../../backend/src/schema/Carta.ts#L28)

- (achado da implementação) `clonarCarta` também precisava copiar `imagem`, ou a foto sumiria especificamente durante `Revelando`.
  [`PartidaRoom.ts:31`](../../backend/src/rooms/PartidaRoom.ts#L31)

**Renderização no frontend**

- Mapa de 32 fotos via `import.meta.glob`, em vez de imports nomeados um a um.
  [`Carta.tsx:91`](../../frontend/src/components/Carta.tsx#L91)

- (achado da revisão) `resolverFotoCarro` distingue "vazio" (residual, silencioso) de "preenchido mas não mapeado" (mismatch real, avisa no console).
  [`Carta.tsx:130`](../../frontend/src/components/Carta.tsx#L130)

- Renderização condicional: foto real ou fallback do placeholder atual.
  [`Carta.tsx:253`](../../frontend/src/components/Carta.tsx#L253)

**Testes**

- (achado da revisão -- o mais importante) Cruza os 32 valores reais de `Imagem` contra os arquivos de verdade em disco, fechando o gap que os outros testes não cobriam.
  [`baralho.test.ts:95`](../../backend/src/game/baralho.test.ts#L95)

- Cobertura de componente da Matrix inteira: foto mapeada, Cartas diferentes com fotos diferentes, fallback vazio, e o novo caso de mismatch com aviso.
  [`Carta.test.tsx`](../../frontend/src/components/Carta.test.tsx)
