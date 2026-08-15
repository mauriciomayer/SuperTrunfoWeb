import "./ListaSalaEspera.css";

/**
 * Forma do `Jogador` do lado do frontend -- espelha `backend/src/schema/Jogador.ts`
 * de proposito (AD-10: nenhum import de codigo entre os pacotes, so rede).
 */
export interface JogadorSalaEspera {
  sessionId: string;
  nome: string;
  isHost: boolean;
  isIA: boolean;
}

interface ListaSalaEsperaProps {
  jogadores: JogadorSalaEspera[];
  meuSessionId: string;
}

/**
 * Lista da Sala de Espera (DESIGN.md/EXPERIENCE.md): uma linha por Jogador
 * a partir de `room.state.jogadores` -- nome + pílula (IA / Você / Entrou).
 * Reusável pela Story 1.4 (lista atualizando em tempo real), que este story
 * não implementa -- aqui é só a renderização do `room.state` atual.
 */
export function ListaSalaEspera({ jogadores, meuSessionId }: ListaSalaEsperaProps) {
  return (
    <div className="lista-sala-espera">
      {jogadores.map((jogador, indice) => (
        <div className="linha-jogador" key={jogador.isIA ? `ia-${indice}` : jogador.sessionId}>
          <span className="nome">
            {jogador.nome}
            {jogador.isHost && <span className="rotulo-host"> (host)</span>}
          </span>
          {jogador.isIA ? (
            <span className="pilula pilula-ia">IA</span>
          ) : (
            <span className="pilula pilula-humano">
              {jogador.sessionId === meuSessionId ? "Você" : "Entrou"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
