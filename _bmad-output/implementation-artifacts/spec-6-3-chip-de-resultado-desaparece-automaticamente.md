---
story: 6.3
title: Chip de Resultado Desaparece Automaticamente
epic: 6
status: done
baseline_commit: '5b8b3ea1def3552b75fa6edf3c19acb77141e5ae'
---

# Spec 6.3: Chip de Resultado Desaparece Automaticamente

## Problema

O Chip de Resultado (`MesaDeJogo.tsx`, `data-testid="chip-resultado"`) so aparece
quando `ultimoResultado.vencedorNome` esta preenchido -- mas nao tem NENHUM
timer, nem esconde sozinho. Hoje ele so "some" quando a proxima Rodada resolve
e sobrescreve `ultimoResultado` com um resultado novo (ou o limpa, no branch de
empate).

Isso conecta com uma divida tecnica ja registrada (`deferred-work.md`, desde a
Story 5.1): `resolverRodada` (`PartidaRoom.ts`) so limpa
`ultimoResultado.vencedorNome`/`atributo` no branch de EMPATE (linhas 735-736).
No branch de vitoria normal, o valor so e SOBRESCRITO quando a rodada seguinte
resolve (linhas 925/929) -- nunca voltando a vazio no meio do caminho. Na
pratica, isso significa que `ultimoResultado.vencedorNome` fica continuamente
preenchido (com o MESMO texto ou um texto novo) ao longo de rodadas
consecutivas sem empate -- o Chip mostra o resultado da rodada N durante TODA
a rodada N+1, inclusive durante a revelacao dela, ate a rodada N+1 resolver.

## Solucao acordada (bmad-party, pos-Epico 5)

Um timer client-side (~3s, sugestao do Murat) que esconde o Chip visualmente
apos alguns segundos sem um resultado novo -- sem tocar no backend.

## Por que um timer sozinho, disparado por "`vencedorNome` ficou truthy", NAO
## basta

Dado o bug acima, `ultimoResultado.vencedorNome` nunca retorna a vazio entre
duas rodadas consecutivas sem empate -- so e sobrescrito. Um efeito que dispara
"mostra + agenda esconder" toda vez que `vencedorNome` MUDA de valor (ou fica
truthy) so dispara de verdade quando o TEXTO muda -- funcionaria na maioria dos
casos (nomes/atributos diferentes entre rodadas), mas e fragil: duas rodadas
seguidas com o MESMO vencedor E o MESMO atributo (perfeitamente possivel,
ex: o mesmo jogador vence com "Velocidade Máxima" duas vezes seguidas) gerariam
o MESMO objeto de conteudo, sem gatilho de re-exibicao nenhum -- o Chip
ficaria escondido (timer da rodada anterior ja expirou) durante uma rodada
cujo resultado NUNCA foi mostrado.

## Sinal robusto: transicao de `estado`

A maquina de estados (AD-5) NUNCA vai de `"Revelando"`/`"SuperTrunfoAcionado"`
direto pra `"Revelando"`/`"SuperTrunfoAcionado"` de novo -- sempre passa por
`"AguardandoSelecao"` (ou `"FimDePartida"`) no meio. Rastrear a TRANSICAO de
`estado.estado` (via `useRef` guardando o valor anterior, comparado a cada
render) garante um disparo por rodada, independente de o conteudo do resultado
coincidir ou nao com o da rodada anterior:

- **Saindo** de `"Revelando"`/`"SuperTrunfoAcionado"` pra qualquer outro
  estado = a rodada acabou de resolver agora -> mostra o Chip, agenda o timer
  de ~3s pra escondê-lo.
- **Entrando** em `"Revelando"`/`"SuperTrunfoAcionado"` (uma rodada NOVA
  comecando) = esconde o Chip IMEDIATAMENTE, mesmo que o timer de ~3s da
  rodada anterior ainda nao tenha expirado -- cobre o segundo bullet do AC
  ("nunca continua visivel durante a Rodada seguinte"), inclusive no caso de
  um jogador rapido que joga antes do timer expirar sozinho. Com a pausa de
  2.5s da IA (Story 6.1) somada a pausa de revelacao (2.5s), cadeias de rodadas
  resolvidas por IA quase sempre deixam o timer expirar sozinho antes -- mas
  entre humanos rapidos, ou Super Trunfo (sem pausa de selecao), a rodada
  seguinte pode comecar a revelar em menos de 3s.
- **Primeira renderizacao** (`estadoAnteriorRef.current` ainda `undefined`) com
  `ultimoResultado.vencedorNome` ja preenchido e `estado` fora de
  `"Revelando"`/`"SuperTrunfoAcionado"`: tratada IGUAL a uma transicao de saida
  (mostra + agenda o timer) -- preserva o comportamento ja coberto pela suite
  hoje (varios testes montam o componente direto com `ultimoResultado` ja
  preenchido e esperam o Chip visivel de imediato).

## Boundaries

**Always:**
- O Chip so pode ficar visivel quando `ultimoResultado.vencedorNome` estiver
  preenchido E a flag local de visibilidade (`mostrarChipResultado` ou nome
  equivalente) estiver `true` -- as duas condicoes continuam necessarias (a
  guarda de `vencedorNome` ja existente continua sendo o que esconde o Chip
  durante um empate, Story 2.5; a flag nova e so uma camada adicional).
- Ao entrar em `"Revelando"`/`"SuperTrunfoAcionado"`, esconder o Chip
  IMEDIATAMENTE (nao esperar o timer), e cancelar qualquer timer pendente.
- Usar `useRef` pro id do timer (`ReturnType<typeof setTimeout> | null`),
  limpando com `clearTimeout` antes de reagendar -- mesmo padrao ja
  estabelecido em `SalaDeEspera.tsx` (Story 5.3, `timerCopiadoRef`).
- Limpar o timer pendente no cleanup do `useEffect` (unmount do componente).
- Duracao do timer: **3000ms** (fixo, sem prop/config nova).

**Never:**
- Nunca alterar `PartidaRoom.ts`/backend -- a divida tecnica do
  `ultimoResultado` nao sendo limpo no branch de vitoria normal fica como
  esta; esta Story resolve o sintoma (visibilidade) inteiramente no client,
  como acordado no bmad-party.
- Nunca aplicar esse timer ao Chip "Eliminado" (`data-testid="chip-eliminado"`,
  linha ~160) nem ao Banner de Vitoria de `FimDePartida.tsx` -- ambos reusam a
  classe base `.chip-resultado` mas sao elementos e ciclos de vida
  completamente diferentes (Story 5.1 ja documenta isso).
- Nunca depender SOMENTE do timer pra esconder o Chip na rodada seguinte (ver
  "Por que um timer sozinho... nao basta" acima) -- a guarda de transicao de
  `estado` e obrigatoria.

## Code Map

`frontend/src/screens/MesaDeJogo.tsx`:
- Novo `useState<boolean>` (ex.: `mostrarChipResultado`, inicial `false`).
- Novo `useRef` pro valor anterior de `estado?.estado` (ex.:
  `estadoAnteriorRef`, inicial `undefined`).
- Novo `useRef` pro id do timer (ex.: `timerEsconderChipRef`, inicial `null`).
- Novo `useEffect` com dependencia em `estado?.estado` (a STRING, nao o objeto
  `estado` inteiro) que implementa a logica de "Sinal robusto" acima; atualiza
  `estadoAnteriorRef.current = estado?.estado` no final do efeito.
- Render do Chip (linha ~348) ganha o guard extra:
  `{ultimoResultado && ultimoResultado.vencedorNome && mostrarChipResultado && (...)}`.
- Constante local pra duracao (ex.: `const DURACAO_CHIP_VISIVEL_MS = 3000;`,
  no topo do arquivo, mesmo estilo de `DURACAO_REVELACAO_MS`/`PAUSA_IA_MS` no
  backend -- so que esta e client-side, sem equivalente no servidor).

`frontend/src/screens/MesaDeJogo.test.tsx`:
- Testes existentes que montam o componente com `ultimoResultado.vencedorNome`
  preenchido e esperam o Chip visivel IMEDIATO (linhas 346-401, 485-499,
  512-572) devem continuar passando sem alteracao -- todos montam com
  `estado: "AguardandoSelecao"` (ou omitem `estado`, mesmo default), nunca
  `"Revelando"`/`"SuperTrunfoAcionado"`, entao caem no caso "primeira
  renderizacao" tratado igual a uma transicao de saida.
- Novos testes precisam usar `vi.useFakeTimers()`/`vi.advanceTimersByTime()`
  (ja usado em outras suites do projeto pra timers, conferir
  `SalaDeEspera.test.tsx` como referencia de padrao) pra cobrir:
  1. Chip visivel logo apos aparecer, ainda visivel um pouco antes dos 3s,
     escondido logo depois dos 3s (sem re-render/mudanca de estado nenhuma no
     meio).
  2. Re-render simulando uma NOVA rodada entrando em `"Revelando"` ANTES dos
     3s expirarem -- Chip some imediatamente (testa o guard de transicao de
     entrada).
  3. Duas rodadas consecutivas com o MESMO `vencedorNome`+`atributo` (o cenario
     que o bug do "timer disparado por valor" nao cobriria) -- Chip reaparece
     na segunda rodada mesmo com o mesmo conteudo textual.
- Sem alteracao nenhuma esperada nos testes do Chip "Eliminado" (linhas
  864-870, 903, 926, 955, 1025).

## Estimativa

Pequena -- uma unica logica de efeito num componente ja existente, sem
mudanca de backend, sem novo componente.

## Revisao (blind-hunter + edge-case-hunter + verification-gap)

Os 3 revisores rodaram em paralelo contra o diff completo. Achado principal,
confirmado de forma independente por blind-hunter E edge-case-hunter (mesmo
mecanismo, rastreado linha a linha nas duas revisoes): sob `<StrictMode>`
(`frontend/src/main.tsx` ja envolve o app inteiro nisso), o dev double-invoke
de um efeito de MONTAGEM (setup -> cleanup -> setup, sem re-render no meio)
pode fazer a 2a chamada de setup encontrar `estadoAnteriorRef` ja preenchido
pela 1a, deixando de reagendar o timer de auto-esconder se `MesaDeJogo`
montasse com `ultimoResultado.vencedorNome` ja preenchido. Confirmado como
**inalcancavel hoje** (`App.tsx` so monta `MesaDeJogo` no momento exato em
que o backend acabou de zerar `ultimoResultado`; sem reconexao/retomada de
sessao no projeto, AD-9) e dev-only (StrictMode e removido em build de
producao) -- documentado em `deferred-work.md` em vez de corrigido, ja que
uma correcao ingenua (reverter o ref no cleanup) quebraria o rastreamento
real de transicoes entre Rodadas de verdade.

verification-gap apontou 3 gaps de cobertura de teste, todos endereçados
nesta rodada:
- `SuperTrunfoAcionado` nunca era exercitado como TRANSICAO (so `"Revelando"`)
  -- novo teste cobrindo a simetria.
- A sequencia de empate (Funil, Story 2.5) sanduichada entre duas Rodadas
  resolvidas nunca era combinada com a logica de visibilidade nova -- novo
  teste cobrindo o cenario completo (resolve -> revela -> empata -> retry
  revela -> retry resolve), provando que o timer "morto" agendado pelo
  branch de empate e corretamente cancelado pela transicao de entrada da
  Rodada seguinte.
- Cleanup do timer no unmount nunca era verificado -- novo teste
  confirmando que desmontar com o timer pendente nao gera erro.

edge-case-hunter tambem notou uma imprecisao de prosa no proprio spec (a
frase sobre cadeias de IA "quase sempre deixarem o timer expirar sozinho" --
na pratica, com `PAUSA_IA_MS` 2500ms &lt; `DURACAO_CHIP_VISIVEL_MS` 3000ms, e
o guard de transicao que dispara primeiro, nao o timer) -- sem impacto no
comportamento observavel (o Chip nunca vaza pra Rodada seguinte de nenhuma
forma), tratado como nota, sem exigir mudanca de codigo.

## Suggested Review Order

1. `frontend/src/screens/MesaDeJogo.tsx:17` -- `DURACAO_CHIP_VISIVEL_MS`.
2. `frontend/src/screens/MesaDeJogo.tsx:219-221` -- os 3 hooks novos
   (`mostrarChipResultado`, `estadoAnteriorRef`, `timerEsconderChipRef`).
3. `frontend/src/screens/MesaDeJogo.tsx:238-279` -- o `useEffect` central
   (deteccao de transicao, os 2 branches, cleanup).
4. `frontend/src/screens/MesaDeJogo.tsx:436` -- guard extra no render do
   Chip (`&& mostrarChipResultado`).
5. `frontend/src/screens/MesaDeJogo.test.tsx:413-561` -- o describe block
   novo inteiro (6 testes: hide-apos-3s, hide-imediato-nova-Rodada,
   reaparece-com-mesmo-conteudo, simetria SuperTrunfoAcionado, empate
   sanduichado, unmount-com-timer-pendente).
6. `_bmad-output/implementation-artifacts/deferred-work.md` (ultima entrada)
   -- o achado do StrictMode, documentado em vez de corrigido.
