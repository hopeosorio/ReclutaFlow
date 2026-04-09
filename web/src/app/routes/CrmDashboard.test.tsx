import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrmDashboard from "@/app/routes/CrmDashboard";
import { MemoryRouter } from "react-router-dom";
import { resetSupabaseMock, setSupabaseMockResponses } from "@/test/supabaseMock";

vi.mock("@/app/AuthProvider", () => ({
  useAuth: () => ({ profile: { role: "rh_admin", full_name: "Admin", id: "u1" } }),
}));

vi.mock("@/app/layouts/CrmLayout", () => ({
  useAppToast: () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }),
  useCrumbs: () => ({ setCrumbs: vi.fn() }),
}));

vi.mock("@/lib/supabaseClient", async () => {
  const { supabaseMock } = await import("@/test/supabaseMock");
  return { supabase: supabaseMock, supabaseUrl: "https://mock.supabase.co", supabaseAnonKey: "mock-key" };
});

const BASE_APPS = [
  {
    id: "app-1", status_key: "new",
    updated_at: "2026-03-04T10:20:00Z", submitted_at: "2026-03-04T09:00:00Z",
    traffic_light: "green", assigned_to: "u1",
    recruit_job_postings: { id: "job-1", title: "Ventas", branch: "CDMX", area: "Comercial" },
    recruit_candidates: { recruit_persons: { first_name: "Ana", last_name: "Pérez", email: "ana@mail.com" } },
    profiles: { full_name: "Reclutador" },
  },
  {
    id: "app-2", status_key: "validation",
    updated_at: "2026-03-03T12:00:00Z", submitted_at: "2026-03-03T11:00:00Z",
    traffic_light: null, assigned_to: null,
    recruit_job_postings: { id: "job-2", title: "Operaciones", branch: null, area: null },
    recruit_candidates: { recruit_persons: { first_name: "Luis", last_name: "Soto", email: "luis@mail.com" } },
    profiles: null,
  },
  {
    id: "app-3", status_key: "hired",
    updated_at: "2026-03-01T10:00:00Z", submitted_at: "2026-02-28T09:00:00Z",
    traffic_light: null, assigned_to: null,
    recruit_job_postings: { id: "job-1", title: "Ventas", branch: "CDMX", area: "Comercial" },
    recruit_candidates: { recruit_persons: { first_name: "Pedro", last_name: "Gómez", email: "pedro@mail.com" } },
    profiles: null,
  },
];

function setupMocks(apps = BASE_APPS) {
  setSupabaseMockResponses({
    recruit_applications: { select: { data: apps, error: null } },
    recruit_statuses: {
      select: {
        data: [
          { status_key: "new", label: "Nuevo Postulante", category: "pipeline", requires_reason: false },
          { status_key: "validation", label: "Validación", category: "pipeline", requires_reason: false },
          { status_key: "hired", label: "Contratado", category: "outcome", requires_reason: false },
        ],
        error: null,
      },
    },
    recruit_job_postings: {
      select: { data: [{ id: "job-1", title: "Ventas" }, { id: "job-2", title: "Operaciones" }], error: null },
    },
    profiles: {
      select: { data: [{ id: "u1", full_name: "Reclutador" }], error: null },
    },
  });
}

describe("CrmDashboard", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setupMocks();
  });

  it("renderiza candidatos activos (sin terminales por defecto)", async () => {
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Luis Soto")).toBeInTheDocument();
    // Pedro (hired) no debe aparecer por defecto
    expect(screen.queryByText("Pedro Gómez")).not.toBeInTheDocument();
  });

  it("KPI Solicitudes Activas excluye terminales", async () => {
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    await screen.findByText("Ana Pérez");
    // 2 activas (new + validation), 1 terminal (hired)
    const kpi = screen.getByText("Solicitudes Activas").closest(".kpi-card");
    expect(kpi?.querySelector(".kpi-value")?.textContent).toBe("2");
  });

  it("filtro de Fase muestra Contratado al seleccionarlo", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    await screen.findByText("Ana Pérez");

    const select = screen.getByLabelText("Fase");
    await user.selectOptions(select, "Contratado");

    expect(await screen.findByText("Pedro Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("filtro de búsqueda por nombre", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    await screen.findByText("Ana Pérez");

    await user.type(screen.getByPlaceholderText("Candidato o correo..."), "luis");
    expect(await screen.findByText("Luis Soto")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("filtro de vacante filtra por job", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    await screen.findByText("Ana Pérez");

    const jobSelect = screen.getByLabelText("Vacante");
    await user.selectOptions(jobSelect, "job-2");

    expect(await screen.findByText("Luis Soto")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay coincidencias", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    await screen.findByText("Ana Pérez");

    await user.type(screen.getByPlaceholderText("Candidato o correo..."), "zzznoresults");
    expect(await screen.findByText("SIN COINCIDENCIAS.")).toBeInTheDocument();
  });

  it("muestra botón Nueva Vacante solo para admin", async () => {
    render(<MemoryRouter><CrmDashboard /></MemoryRouter>);
    await screen.findByText("Ana Pérez");
    expect(screen.getByRole("button", { name: /Nueva Vacante/i })).toBeInTheDocument();
  });
});
