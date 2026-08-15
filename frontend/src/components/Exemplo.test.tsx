import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Exemplo } from "./Exemplo.tsx";

describe("scaffolding -- camada de componente (AD-12)", () => {
  it("renderiza a mensagem recebida", () => {
    render(<Exemplo mensagem="Super Trunfo Web" />);
    expect(screen.getByText("Super Trunfo Web")).toBeInTheDocument();
  });
});
