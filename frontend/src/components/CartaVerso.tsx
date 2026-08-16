import "./CartaVerso.css";

/**
 * Carta (verso) -- DESIGN.md > Componentes ("Carta (verso)"): usada pras
 * Cartas dos oponentes antes da revelação. Fundo amarelo + grade fina +
 * wordmark genérico -- nenhuma informação identificável (nem Grupo/Letra,
 * nem ID, nem foto, nem Atributo). Sem props: é sempre idêntica,
 * independente de qual Carta real está por baixo -- e esse é o ponto: nem
 * o componente sabe qual Carta é (o servidor nunca manda essa informação
 * pra quem não é o dono, ver `PartidaRoom.ts`/AD-3).
 */
export function CartaVerso() {
  return (
    <div className="carta-verso" role="img" aria-label="Carta virada, valor oculto">
      <span className="carta-verso__wordmark">ST</span>
    </div>
  );
}
