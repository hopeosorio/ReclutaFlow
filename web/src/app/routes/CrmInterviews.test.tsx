import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@/test/fullcalendarMock";
import CrmInterviews from "@/app/routes/CrmInterviews";
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

const PENDING_INTERVIEW = {
  id: "int-1",
  interview_type: "virtual",
  scheduled_at: new Date(Date.now() + 48 * 3600000).toISOString(),
  location: null,
  result: "pending",
  notes: null,
  recruit_applications: {
    id: "app-1",
    status_key: "virtual_scheduled",
    meet_link: "https://meet.jit.si/test",
    recruit_job_postings: { title: "Ventas", branch: "CDMX" },
    recruit_candidates: {
      recruit_persons: { first_name: "Ana", last_name: "Pérez", email: "ana@mail.com", phone: "555" },
    },
  },
};

const DONE_INTERVIEW = {
  id: "int-2",
  interview_type: "virtual",
  scheduled_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  location: null,
  result: "pass",
  notes: "Muy buen candidato",
  recruit_applications: {
    id: "app-2",
    status_key: "virtual_done",
    meet_link: null,
    recruit_job_postings: { title: "Operaciones", branch: null },
    recruit_candidates: {
      recruit_persons: { first_name: "Luis", last_name: "Soto", email: "luis@mail.com", phone: null },
    },
  },
};

describe("CrmInterviews", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockResponses({
      recruit_interviews: {
        select: { data: [PENDING_INTERVIEW, DONE_INTERVIEW], error: null },
      },
    });
  });

  it("muestra calendario por defecto", async () => {
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    expect(await screen.findByTestId("fullcalendar")).toBeInTheDocument();
  });

  it("cambia a vista de lista", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");

    await user.click(screen.getByRole("button", { name: /Lista/i }));
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Luis Soto")).toBeInTheDocument();
  });

  it("entrevista pendiente muestra selector de dictamen", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");
    await user.click(screen.getByRole("button", { name: /Lista/i }));

    await screen.findByText("Ana Pérez");
    expect(screen.getByRole("combobox", { name: /DICTAMEN/i })).toBeInTheDocument();
  });

  it("entrevista aprobada muestra badge APROBADO sin formulario", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");
    await user.click(screen.getByRole("button", { name: /Lista/i }));

    await screen.findByText("Luis Soto");
    expect(screen.getByText("APROBADO")).toBeInTheDocument();
    // No debe mostrar selector de dictamen para la entrevista terminada
    expect(screen.queryAllByRole("combobox", { name: /DICTAMEN/i })).toHaveLength(1); // solo la pendiente
  });

  it("botón Firmar resultado desactivado con dictamen pendiente", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");
    await user.click(screen.getByRole("button", { name: /Lista/i }));

    await screen.findByText("Ana Pérez");
    const firmar = screen.getByRole("button", { name: /Firmar resultado/i });
    expect(firmar).toBeDisabled();
  });

  it("botón Firmar resultado se habilita al seleccionar un dictamen", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");
    await user.click(screen.getByRole("button", { name: /Lista/i }));

    await screen.findByText("Ana Pérez");
    await user.selectOptions(screen.getByRole("combobox", { name: /DICTAMEN/i }), "pass");
    expect(screen.getByRole("button", { name: /Firmar resultado/i })).not.toBeDisabled();
  });

  it("botón Meet oculto para entrevista terminada", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");
    await user.click(screen.getByRole("button", { name: /Lista/i }));

    await screen.findByText("Luis Soto");
    const meetLinks = screen.queryAllByRole("link", { name: /Meet/i });
    // Solo la entrevista pendiente puede tener Meet
    meetLinks.forEach(l => expect(l).not.toHaveAccessibleName(/Luis Soto/));
  });

  it("KPIs solo visibles en vista lista", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await screen.findByTestId("fullcalendar");
    // En calendario no se muestra el strip de KPIs
    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lista/i }));
    expect(await screen.findByText("Pendientes")).toBeInTheDocument();
  });

  it("estado vacío cuando no hay entrevistas", async () => {
    setSupabaseMockResponses({ recruit_interviews: { select: { data: [], error: null } } });
    const user = userEvent.setup();
    render(<MemoryRouter><CrmInterviews /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: /Lista/i }));
    expect(await screen.findByText("SIN ENTREVISTAS")).toBeInTheDocument();
  });
});
