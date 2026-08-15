import { describe, expect, it } from "vitest";
import { somar } from "./exemplo.ts";

describe("scaffolding -- camada unitaria (AD-12)", () => {
  it("soma dois numeros", () => {
    expect(somar(2, 3)).toBe(5);
  });
});
