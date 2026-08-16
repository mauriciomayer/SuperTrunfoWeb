import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CartaVerso } from "./CartaVerso.tsx";

afterEach(() => {
  cleanup();
});

/**
 * Camada de componente (AD-12) da Carta (verso) -- Story 2.1. Confirma o
 * Boundaries mais crítico deste componente: nenhuma informação
 * identificável (nem Grupo/Letra, nem ID, nem Atributo) -- o componente
 * nem recebe uma Carta como prop, então não há como vazar nada por
 * engano.
 */
describe("CartaVerso -- camada de componente (AD-12)", () => {
  it("renderiza sem receber nenhum dado de Carta (nenhuma prop)", () => {
    render(<CartaVerso />);
    expect(screen.getByRole("img", { name: "Carta virada, valor oculto" })).toBeInTheDocument();
  });

  it("nao expoe Grupo/Letra/ID nem qualquer texto de Atributo", () => {
    render(<CartaVerso />);
    // So o wordmark generico "ST" deve aparecer -- nada que lembre um ID
    // de Carta (ex: "2A") ou um valor de Atributo.
    expect(screen.getByText("ST")).toBeInTheDocument();
  });
});
