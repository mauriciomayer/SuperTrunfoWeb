---
title: 'Product Brief: Super Trunfo Web'
status: complete
created: '2026-08-14'
updated: '2026-08-14'
---

# Product Brief: Super Trunfo Web

## Resumo Executivo

Super Trunfo Web é uma versão digital multiplayer do jogo de cartas brasileiro Super Trunfo, com baralho temático de carros (32 cartas, 8 grupos por categoria/país), partidas de 2 a 4 jogadores em tempo real via WebSocket, e IA preenchendo as vagas quando não há jogadores humanos suficientes. É um projeto de paixão: o objetivo imediato é aprender construindo algo divertido para jogar com família e amigos — não lançar um produto comercial.

O motivo para existir agora não é apenas nostálgico. A pesquisa de mercado conduzida para este projeto confirmou que **não existe hoje nenhuma versão digital ativa do Super Trunfo com multiplayer real pela internet** — nem mesmo da própria Grow, detentora da marca, cujo app oficial está abandonado desde 2015. Ao mesmo tempo, pesquisas do setor de games no Brasil (PGB 2026) mostram nostalgia como driver comprovado de consumo, e o público que cresceu jogando Super Trunfo físico (hoje na faixa de 30-44 anos) é a maior coorte de jogadores adultos do país. Ou seja: o terreno que este projeto pretende ocupar, mesmo sem essa ser a motivação principal, está genuinamente vazio.

## O Problema

Quem quer jogar Super Trunfo hoje, digitalmente, com outras pessoas pela internet, não tem uma opção boa. As alternativas existentes falham de formas específicas e documentadas: o app oficial da Grow ("Super Trunfo Battle Cards") está tecnicamente obsoleto (sem atualização desde 2015, monetizado com anúncios e moeda virtual); um app acadêmico ("Super Trunfo Elementar") só permite multiplayer na mesma rede local, não pela internet; e o restante do cenário digital é fragmentado em projetos pequenos, sem tema de carros e sem tração visível. A comunidade brasileira de board games discute o Super Trunfo apenas como lembrança de infância — a versão digital simplesmente não faz parte da conversa.

Para o escopo pessoal deste projeto, o problema é mais direto: não existe uma forma simples de reunir família e amigos numa partida de Super Trunfo à distância, com as regras completas (incluindo a carta especial e o desempate) automatizadas e sem depender de estar todos no mesmo lugar ou na mesma rede.

## A Solução

Uma plataforma web que replica fielmente as regras do Super Trunfo físico — descritas em detalhe em `docs/requisitos_super_trunfo.md` (RF01-RF06, RNF01-RNF04) — com baralho de carros, partidas em tempo real para 2-4 jogadores, IA preenchendo vagas quando faltam humanos, e a dinâmica completa: seleção de atributo, comparação automática, a regra especial da carta Super Trunfo (com a exceção da carta "letra A"), resolução de empate por "funil", e fim de jogo por eliminação ou consolidação do baralho. Acessível por navegador, sem instalação, funcionando em mobile e desktop.

## O Que Torna Isso Diferente

Ser honesto aqui importa mais do que soar impressionante: **o diferencial não é técnico nem de execução superior — é que praticamente ninguém está competindo nesse espaço específico.** Não existe hoje um concorrente direto (Super Trunfo digital, temático de carros, com multiplayer real-time) para superar. O produto mais próximo mecanicamente (Top Drives, da Hutch Games) é internacional, não carrega a marca Super Trunfo, e não tem apelo de nostalgia brasileira.

Isso não é um fosso defensável — é um vácuo que existe hoje e pode não existir amanhã, se a própria Grow ou outra empresa decidir preencher. Para um projeto de paixão, isso não muda nada; para uma eventual evolução a produto, é um ponto a monitorar, não uma vantagem permanente.

## Quem Isso Atende

**Público primário (v1):** o próprio criador do projeto, além de familiares e amigos — pessoas que já têm relação pessoal com quem está construindo o jogo e topam jogar partidas reais assim que estiver pronto.

**Público secundário (potencial, não perseguido nesta fase):** adultos brasileiros de 30-44 anos que jogavam Super Trunfo físico quando crianças — a coorte que a pesquisa de mercado identifica como a maior entre os jogadores adultos do Brasil, e para quem nostalgia é um driver de consumo comprovado. `[SUPOSIÇÃO]` Este público não está sendo endereçado ativamente no momento; fica registrado como direção plausível caso o projeto avance para além do círculo pessoal.

## Critérios de Sucesso

Não há metas formais definidas para esta fase — decisão deliberada do criador, dado o caráter de projeto de paixão/aprendizado. Sucesso na v1 significa: o jogo funciona de ponta a ponta com as regras corretas, é divertido o suficiente para família e amigos jogarem de verdade, e o processo de construção entrega o aprendizado técnico buscado (arquitetura em tempo real, WebSocket, lógica de jogo). `[SUPOSIÇÃO]` Métricas quantitativas (jogadores ativos, retenção, etc.) ficam deliberadamente fora de escopo até uma eventual decisão de evoluir para produto.

## Escopo

**Dentro do escopo (v1):**
- Baralho único, temático de carros, 32 cartas / 8 grupos, conforme `docs/requisitos_super_trunfo.md`
- Partidas de 2 a 4 jogadores, com IA preenchendo vagas quando faltam humanos
- Todas as regras RF01-RF06: game loop, carta Super Trunfo e sua exceção, resolução de empate, eliminação e fim de jogo
- Multiplayer real-time via WebSocket
- Anti-cheat de estado (monte do jogador protegido contra inspeção indevida)
- Interface responsiva (mobile e desktop)

**Fora do escopo (por enquanto):**
- Outros temas de baralho além de carros
- Contas de jogador persistentes, histórico ou ranking entre partidas `[SUPOSIÇÃO]` — não discutido diretamente; assumido fora de escopo por não aparecer nos requisitos técnicos nem ter sido mencionado como necessidade
- Matchmaking com desconhecidos (o uso previsto é com família/amigos)
- Qualquer modelo de monetização
- Resolução do licenciamento da marca "Super Trunfo" junto à Grow — ver Riscos abaixo

## Riscos & Decisões em Aberto

- **Marca "Super Trunfo":** a pesquisa de mercado confirmou que a Grow é a detentora da marca no Brasil. A decisão tomada foi manter o nome como está enquanto o projeto for pessoal, e revisitar (licenciamento formal ou rebranding) somente se ele evoluir para algo além do círculo de família e amigos. Isso é aceitável para uso pessoal/privado; não é uma decisão válida para lançamento público sem validação jurídica.
- **Visão de produto:** deliberadamente não definida. O criador prefere sentir o projeto rodando antes de imaginar próximos passos (mais temas, monetização, comunidade) — registrado aqui como ausência consciente, não como lacuna esquecida.

## Visão

Sem compromisso definido — e isso é intencional nesta fase. Se o projeto ganhar tração além do círculo pessoal, os pontos naturais a revisitar seriam: o nome/marca (ver Riscos), novos temas de baralho, e se faz sentido abrir para jogadores além de família e amigos. Nenhuma dessas direções foi validada; ficam registradas apenas como o tipo de decisão que este brief adiaria para uma futura revisão, não como plano.
