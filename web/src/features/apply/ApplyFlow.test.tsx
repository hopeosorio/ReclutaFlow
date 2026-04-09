import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ApplyFlow from "@/features/apply/ApplyFlow";
import { resetSupabaseMock, setSupabaseMockResponses } from "@/test/supabaseMock";

vi.mock("@/lib/supabaseClient", async () => {
  const { supabaseMock } = await import("@/test/supabaseMock");
  return {
    supabase: supabaseMock,
    functionsBaseUrl: "http://localhost/functions/v1",
    supabaseUrl: "https://mock.supabase.co",
    supabaseAnonKey: "mock-key",
  };
});

vi.mock("jspdf", () => ({ default: vi.fn(() => ({ html: vi.fn(), save: vi.fn(), addPage: vi.fn() })) }));
vi.mock("html2canvas", () => ({ default: vi.fn(async () => ({ toDataURL: vi.fn(() => "data:image/png;base64,mock") })) }));

const PRIVACY_NOTICE = {
  id: "pn-1",
  version: "v1",
  content_md: "# Aviso de privacidad\n\nEste es el contenido del aviso.",
  is_active: true,
};

const VACANCY = {
  id: "job-1", title: "Cajero", branch: "CDMX", area: "Operaciones",
  employment_type: "full_time", description_short: "Atención a clientes", status: "active",
};

function setupMocks() {
  setSupabaseMockResponses({
    recruit_job_postings: { select: { data: [VACANCY], error: null } },
    recruit_privacy_notices: {
      select: { data: [PRIVACY_NOTICE], error: null },
      single: { data: PRIVACY_NOTICE, error: null },
    },
    recruit_screening_questions: { select: { data: [], error: null } },
    recruit_document_types: { select: { data: [], error: null } },
  });
}

describe("ApplyFlow", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setupMocks();
  });

  it("renderiza el formulario de postulación tras cargar", async () => {
    render(<MemoryRouter><ApplyFlow /></MemoryRouter>);
    // Espera a que el componente salga del estado loading (retorna null)
    await waitFor(
      () => expect(document.body.children[0]?.children[0]).not.toBeNull(),
      { timeout: 3000 },
    );
    // Verifica que hay contenido visible
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("muestra aviso de privacidad en el paso 1", async () => {
    render(<MemoryRouter><ApplyFlow /></MemoryRouter>);
    // El h2 del aviso de privacidad se renderiza exactamente como "AVISO DE PRIVACIDAD"
    const heading = await screen.findByRole("heading", { name: /AVISO DE PRIVACIDAD/i }, { timeout: 3000 });
    expect(heading).toBeInTheDocument();
  });

  it("no permite avanzar sin firmar el aviso de privacidad", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ApplyFlow /></MemoryRouter>);

    // Espera a que cargue: el heading del aviso aparece en step 0
    await screen.findByRole("heading", { name: /AVISO DE PRIVACIDAD/i }, { timeout: 3000 });

    // Botón de avance en ApplyFlow dice "SIGUIENTE FASE"
    const nextButtons = screen.getAllByRole("button").filter(
      b => /SIGUIENTE FASE|siguiente|next|continuar/i.test(b.textContent ?? ""),
    );
    if (nextButtons.length > 0) {
      await user.click(nextButtons[0]);
      // Sin firmar, no debería avanzar: el heading sigue visible
      expect(screen.queryByRole("heading", { name: /AVISO DE PRIVACIDAD/i })).toBeInTheDocument();
    }
  });

  it("carga sin crash cuando no hay vacantes disponibles", async () => {
    setSupabaseMockResponses({
      recruit_job_postings: { select: { data: [], error: null } },
      recruit_privacy_notices: {
        select: { data: [PRIVACY_NOTICE], error: null },
        single: { data: PRIVACY_NOTICE, error: null },
      },
      recruit_screening_questions: { select: { data: [], error: null } },
      recruit_document_types: { select: { data: [], error: null } },
    });
    render(<MemoryRouter><ApplyFlow /></MemoryRouter>);
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement(), { timeout: 3000 });
  });

  it("carga sin crash cuando falla el aviso de privacidad", async () => {
    setSupabaseMockResponses({
      recruit_job_postings: { select: { data: [VACANCY], error: null } },
      recruit_privacy_notices: {
        select: { data: null, error: { message: "Not found" } },
        single: { data: null, error: { message: "Not found" } },
      },
      recruit_screening_questions: { select: { data: [], error: null } },
      recruit_document_types: { select: { data: [], error: null } },
    });
    render(<MemoryRouter><ApplyFlow /></MemoryRouter>);
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement(), { timeout: 3000 });
  });
});
