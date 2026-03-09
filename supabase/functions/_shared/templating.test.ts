import { renderTemplate } from "./templating.ts";

Deno.test("renderTemplate replaces tokens", () => {
  const result = renderTemplate("Hola {name}, folio {folio}", {
    name: "Ana",
    folio: "A-001",
  });
  if (result !== "Hola Ana, folio A-001") {
    throw new Error(`Unexpected result: ${result}`);
  }
});

Deno.test("renderTemplate keeps unknown tokens", () => {
  const result = renderTemplate("Hola {name} {unknown}", { name: "Ana" });
  if (result !== "Hola Ana {unknown}") {
    throw new Error(`Unexpected result: ${result}`);
  }
});
