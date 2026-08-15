import { Server, WebSocketTransport } from "colyseus";
import { PartidaRoom } from "./rooms/PartidaRoom.ts";
import { servirFrontendEstaticoSeExistir } from "./servirFrontendEstatico.ts";

const PORT = Number(process.env.PORT ?? 2567);

const transport = new WebSocketTransport();
const gameServer = new Server({
  transport,
});

gameServer.define("partida", PartidaRoom);

// Precisa rodar depois que o `Server` termina de montar o transporte (so ai
// `transport.getExpressApp()` existe) e antes de `gameServer.listen()` --
// ver a documentacao de `servirFrontendEstaticoSeExistir` pro porque exato.
servirFrontendEstaticoSeExistir(transport);

gameServer
  .listen(PORT)
  .then(() => {
    // Sem "localhost" fixo: em producao (Render) o processo nao roda em
    // localhost, e essa linha e' exatamente o que o DEPLOY.md pede pro
    // usuario procurar no log como confirmacao de que o deploy funcionou.
    console.log(`[backend] servidor Colyseus rodando na porta ${PORT}`);
  })
  .catch((erro) => {
    console.error("[backend] falha ao subir servidor:", erro);
    process.exit(1);
  });
