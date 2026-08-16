import "./Funil.css";

interface FunilProps {
  /**
   * Espelha `EstadoPartida.funil.quantidadeCartasPresas` (Story 2.5) --
   * unico campo publico do Funil, ver `backend/src/schema/Funil.ts`.
   * `cartasPresas` nunca e concedida a nenhum Client (anti-cheat, mesma
   * postura padrao-segura de `Rodada.cartasEmDisputa`), entao o frontend
   * nunca teria conteudo de Carta pra mostrar aqui de qualquer jeito -- so
   * a contagem.
   */
  quantidadeCartasPresas: number;
  /**
   * Nome do Jogador da vez (quem abriu a Rodada empatada e vai escolher o
   * proximo Atributo, sem passar a vez) -- decidido por quem renderiza
   * (`MesaDeJogo.tsx`), nunca calculado aqui.
   */
  nomeJogadorDaVez?: string;
}

/**
 * Funil (Story 2.5, Boundaries "Always") -- tray "🃏 Cartas presas no
 * Funil (N)" + mensagem de desempate, visivel sempre que
 * `quantidadeCartasPresas > 0`, independente do `estado` atual da Partida
 * (persiste durante toda a sequencia de desempate -- inclusive empates
 * consecutivos -- nao so logo apos o empate). Some sozinho assim que uma
 * Rodada de desempate resolve sem empate (o vencedor leva tudo, o Funil
 * esvazia, `quantidadeCartasPresas` volta a 0).
 */
export function Funil({ quantidadeCartasPresas, nomeJogadorDaVez }: FunilProps) {
  if (quantidadeCartasPresas <= 0) {
    return null;
  }

  return (
    <div className="funil" data-testid="funil" role="status">
      <span className="funil__titulo">🃏 Cartas presas no Funil ({quantidadeCartasPresas})</span>
      <span className="funil__mensagem">
        Empate! {nomeJogadorDaVez ?? "o Jogador da vez"} escolhe um novo atributo com a próxima
        carta.
      </span>
    </div>
  );
}
