/**
 * Placeholder de `src/components/` (Story 1.1 -- scaffolding).
 *
 * Nao e um componente real de jogo -- so existe para dar a segunda camada
 * da piramide de testes (AD-12) algo trivial pra renderizar isolado com
 * React Testing Library. Os componentes de verdade (Carta, Funil, etc.)
 * chegam no resto do Epico 1 e 2.
 */
export function Exemplo({ mensagem }: { mensagem: string }) {
  return <p>{mensagem}</p>;
}
