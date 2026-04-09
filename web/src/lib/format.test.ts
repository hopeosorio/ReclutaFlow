import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("devuelve — para undefined", () => {
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("devuelve — para null", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("devuelve — para string vacío", () => {
    expect(formatDateTime("")).toBe("—");
  });

  it("devuelve — para fecha inválida", () => {
    expect(formatDateTime("no-es-fecha")).toBe("—");
  });

  it("formatea una fecha ISO válida con hora", () => {
    const result = formatDateTime("2026-03-04T15:00:00Z");
    // Verifica que contiene partes de fecha en español
    expect(result).toMatch(/\d{4}/); // año
    expect(result).not.toBe("—");
  });
});

describe("formatDate", () => {
  it("devuelve — para undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("devuelve — para null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("devuelve — para string vacío", () => {
    expect(formatDate("")).toBe("—");
  });

  it("devuelve — para fecha inválida", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("formatea una fecha ISO válida sin hora", () => {
    const result = formatDate("2026-06-15T00:00:00Z");
    expect(result).not.toBe("—");
    expect(result).toMatch(/jun|Jun/i);
  });
});
