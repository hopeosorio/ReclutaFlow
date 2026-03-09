import { describe, expect, it } from "vitest";
import { resolveFunctionsBaseUrl } from "./resolveFunctionsBaseUrl";

describe("resolveFunctionsBaseUrl", () => {
  const supabaseUrl = "https://example.supabase.co";

  it("falls back when empty", () => {
    expect(resolveFunctionsBaseUrl(supabaseUrl, "")).toBe(`${supabaseUrl}/functions/v1`);
  });

  it("uses absolute base when provided", () => {
    const base = "https://functions.example.com";
    expect(resolveFunctionsBaseUrl(supabaseUrl, base)).toBe(base);
  });

  it("falls back when base matches origin", () => {
    const origin = "http://localhost:5175";
    expect(resolveFunctionsBaseUrl(supabaseUrl, origin, origin)).toBe(`${supabaseUrl}/functions/v1`);
  });

  it("falls back when base is relative", () => {
    expect(resolveFunctionsBaseUrl(supabaseUrl, "/functions/v1")).toBe(`${supabaseUrl}/functions/v1`);
  });
});
