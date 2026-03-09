import { requireFields } from "./validation.ts";

Deno.test("requireFields returns missing keys", () => {
  const missing = requireFields({ a: 1 }, ["a", "b", "c"]);
  if (missing.length !== 2 || !missing.includes("b") || !missing.includes("c")) {
    throw new Error(`Unexpected missing: ${missing.join(",")}`);
  }
});

Deno.test("requireFields ignores present values", () => {
  const missing = requireFields({ a: "ok", b: 0 }, ["a", "b"]);
  if (missing.length !== 0) {
    throw new Error(`Unexpected missing: ${missing.join(",")}`);
  }
});
