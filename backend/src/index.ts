import { Server, WebSocketTransport } from "colyseus";
import { PartidaRoom } from "./rooms/PartidaRoom.ts";

const PORT = Number(process.env.PORT ?? 2567);

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

gameServer.define("partida", PartidaRoom);

gameServer
  .listen(PORT)
  .then(() => {
    console.log(`[backend] servidor Colyseus rodando em ws://localhost:${PORT}`);
  })
  .catch((erro) => {
    console.error("[backend] falha ao subir servidor:", erro);
    process.exit(1);
  });
