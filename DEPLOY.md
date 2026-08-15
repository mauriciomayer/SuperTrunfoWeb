# Deploy no Render

Guia manual pra publicar o Super Trunfo Web num link real, acessível de fora da sua rede. Backend e frontend sobem juntos, como um único serviço -- o backend serve o build do frontend pelo mesmo processo/porta que também aceita a conexão Colyseus (WebSocket), então não existe CORS nem domínio separado pra configurar.

Um único ambiente de produção. Sem staging, sem CI/CD, sem domínio customizado -- desproporcional a um projeto de uso hobby (família/amigos, poucas salas simultâneas).

## Pré-requisitos

- O código precisa estar no GitHub: o Render puxa o build direto do repositório, então dê `git push` pra sua branch principal **antes** de configurar o serviço. Qualquer deploy novo depois disso também depende de um `git push` -- o Render não vê nada que só existe local.
- Uma conta no [Render](https://render.com) (dá pra criar com login do GitHub, sem custo pro plano usado aqui).

## Passo a passo

1. **Criar a conta**: entre em [render.com](https://render.com) e cadastre-se (o mais simples é "Sign up with GitHub", já que o Render precisa de acesso ao repositório de qualquer forma).
2. **Novo Web Service**: no dashboard do Render, clique em **New +** → **Web Service**.
3. **Conectar o repositório**: autorize o Render a acessar sua conta do GitHub e selecione o repositório `SuperTrunfoWeb`.
4. **Configurar o serviço**:
   - **Name**: qualquer nome (ex.: `super-trunfo-web`) -- vira parte do link público (`https://<name>.onrender.com`).
   - **Region**: a mais próxima de você/da família.
   - **Branch**: a branch que você acabou de dar push (normalmente `main`).
   - **Runtime**: `Node`.
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/__healthcheck` -- endpoint que já vem de graça, embutido no roteador do Colyseus (nenhum código novo precisa disso); ajuda o Render a perceber mais rápido se o processo travou.
   - **Instance Type**: o plano gratuito serve pra validar; ele "dorme" depois de um tempo sem uso e demora alguns segundos pra acordar no próximo acesso -- se isso incomodar, o plano pago mais barato resolve.
5. **Variáveis de ambiente**: nenhuma é obrigatória. O Render já define `PORT` sozinho e o backend já lê de `process.env.PORT`. Ele também já define `NODE_ENV=production` sozinho em runtime pra qualquer serviço com **Runtime: Node** -- é esse valor que o backend usa pra decidir se serve o `frontend/dist` (nunca em dev local); não precisa (e não deve) configurar isso manualmente aqui. Só adicione `VITE_BACKEND_URL` (em **Environment**) se algum dia quiser separar o frontend do backend em hosts diferentes -- não é o caso deste deploy de origem única.
6. **Create Web Service**: o Render clona o repositório, roda o Build Command (`npm run build`, que instala e builda `backend/` e `frontend/`) e depois o Start Command (`npm start`, que sobe o backend já buildado servindo o frontend estático). Acompanhe o log até aparecer algo como `[backend] servindo frontend estatico de .../frontend/dist` **antes** de `[backend] servidor Colyseus rodando na porta <porta>` -- essa ordem é esperada (o estático é registrado antes do servidor terminar de subir).
7. **Abrir o link**: o Render mostra a URL pública no topo da página do serviço (`https://<name>.onrender.com`). Abra -- deve aparecer a tela de Criar Sala.
8. **Auto-deploy fica ligado por padrão**: a partir de agora, todo `git push` na branch selecionada no passo 4 (`main`) dispara um novo deploy automático -- o Render fica observando o repositório. Isso é o comportamento normal e desejado (é como você vai publicar atualizações depois), mas vale saber antes de dar o próximo push sem querer achando que "é só local". Pra desligar (ex.: quer subir algo sem publicar ainda), tem um toggle "Auto-Deploy" nas configurações do serviço.

## Importante: processo de longa duração, nunca serverless

Este serviço precisa ser um **Web Service** normal do Render (processo Node que fica rodando), não uma função serverless. WebSocket persistente e o estado da Sala/Partida vivem na memória do processo -- serverless mata a conexão e perde o estado entre requisições. O passo 4 acima (`Runtime: Node`, `Web Service`) já garante isso; não troque por nenhuma opção de "Function"/"Serverless" que o Render ofereça em outros fluxos.

## Teste final (fora do escopo automatizável -- confirme você mesmo)

Depois que o serviço estiver no ar:

1. Crie uma sala no link publicado.
2. Copie o link de convite gerado.
3. Peça pra alguém **fora da sua rede local** (não conectado no mesmo Wi-Fi) abrir esse link no navegador dele.
4. Confirme que essa pessoa consegue entrar na Sala de Espera e aparecer na lista em tempo real pra você.

Se isso funcionar, o deploy está completo -- este é o critério de aceite final da história, e só pode ser confirmado depois do deploy real (não tem como automatizar sem o serviço estar de fato publicado).
