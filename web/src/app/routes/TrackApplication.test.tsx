import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TrackApplication from "./TrackApplication";
import { resetSupabaseMock, setSupabaseMockResponses } from "@/test/supabaseMock";

vi.mock("@/lib/supabaseClient", async () => {
  const { supabaseMock } = await import("@/test/supabaseMock");
  return { supabase: supabaseMock, supabaseUrl: "https://mock.supabase.co", supabaseAnonKey: "mock-key" };
});

// The component displays first_name uppercased only (not full name)
const APP_RESPONSE = {
  id: "app-1",
  status_key: "new",
  meet_link: null,
  profiles: null,
  submitted_at: "2026-03-04T09:00:00Z",
  recruit_job_postings: { title: "Ventas", branch: "CDMX" },
  recruit_candidates: {
    recruit_persons: { first_name: "Ana", last_name: "Pérez", email: "ana@mail.com" },
  },
};

function renderTrack(id?: string) {
  const url = id ? `/track?id=${id}` : "/track";
  return render(
    <MemoryRouter initialEntries={[url]}>
      <TrackApplication />
    </MemoryRouter>,
  );
}

describe("TrackApplication", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockResponses({
      recruit_applications: {
        single: { data: APP_RESPONSE, error: null },
        select: { data: APP_RESPONSE, error: null },
      },
      recruit_application_documents: { select: { data: [], error: null } },
      recruit_document_types: { select: { data: [], error: null } },
    });
  });

  it("muestra el campo de búsqueda al iniciar sin ID", () => {
    renderTrack();
    // El placeholder contiene "EJ:" según el código fuente
    expect(screen.getByPlaceholderText(/EJ:/i)).toBeInTheDocument();
  });

  it("muestra el nombre del candidato (first_name en mayúsculas) tras buscar con ID en URL", async () => {
    renderTrack("app-1");
    // El componente muestra "HOLA, ANA." — el nombre está en el mismo nodo que el saludo
    expect(await screen.findByText(/HOLA.*ANA/i)).toBeInTheDocument();
  });

  it("muestra el título de la vacante en mayúsculas", async () => {
    renderTrack("app-1");
    // Espera a que cargue el candidato
    await screen.findByText(/HOLA.*ANA/i);
    // El componente muestra jobTitle.toUpperCase() = "VENTAS"
    expect(screen.getAllByText(/VENTAS/i).length).toBeGreaterThan(0);
  });

  it("muestra error cuando no se encuentra la postulación", async () => {
    setSupabaseMockResponses({
      recruit_applications: {
        single: { data: null, error: { message: "Not found" } },
        select: { data: null, error: { message: "Not found" } },
      },
      recruit_application_documents: { select: { data: [], error: null } },
      recruit_document_types: { select: { data: [], error: null } },
    });
    renderTrack("bad-id");
    // El h2 muestra "ID NO ENCONTRADO" cuando la postulación no existe
    expect(await screen.findByRole("heading", { name: /ENCONTRADO/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("permite buscar manualmente escribiendo un ID", async () => {
    const user = userEvent.setup();
    renderTrack();
    const input = screen.getByPlaceholderText(/EJ:/i);
    await user.type(input, "app-1");
    await user.click(screen.getByRole("button"));
    // El componente muestra "HOLA, ANA." cuando carga la postulación
    expect(await screen.findByText(/HOLA.*ANA/i)).toBeInTheDocument();
  });
});
