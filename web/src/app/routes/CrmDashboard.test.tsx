import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrmDashboard from "@/app/routes/CrmDashboard";
import { MemoryRouter } from "react-router-dom";
import {
  resetSupabaseMock,
  setSupabaseMockResponses,
  supabaseMock,
} from "@/test/supabaseMock";

vi.mock("@/app/AuthProvider", () => ({
  useAuth: () => ({ profile: { role: "rh_admin", full_name: "Admin" } }),
}));

vi.mock("@/lib/supabaseClient", async () => {
  const { supabaseMock } = await import("@/test/supabaseMock");
  return { supabase: supabaseMock };
});

describe("CrmDashboard", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockResponses({
      recruit_applications: {
        select: {
          data: [
            {
              id: "app-1",
              status_key: "to_call",
              updated_at: "2026-03-04T10:20:00Z",
              submitted_at: "2026-03-04T09:00:00Z",
              traffic_light: "green",
              assigned_to: "user-1",
              recruit_job_postings: { id: "job-1", title: "Ventas", branch: "CDMX", area: "Comercial" },
              recruit_candidates: {
                recruit_persons: { first_name: "Ana", last_name: "Pérez", email: "ana@correo.com" },
              },
              profiles: { full_name: "Reclutador" },
            },
            {
              id: "app-2",
              status_key: "new",
              updated_at: "2026-03-03T12:00:00Z",
              submitted_at: "2026-03-03T11:00:00Z",
              traffic_light: null,
              assigned_to: null,
              recruit_job_postings: { id: "job-2", title: "Operaciones", branch: null, area: null },
              recruit_candidates: {
                recruit_persons: { first_name: "Luis", last_name: "Soto", email: "luis@correo.com" },
              },
              profiles: null,
            },
          ],
          error: null,
        },
      },
      recruit_statuses: {
        select: {
          data: [
            { status_key: "to_call", label: "Por llamar", requires_reason: false },
            { status_key: "new", label: "Solicitud recibida", requires_reason: false },
          ],
          error: null,
        },
      },
      recruit_job_postings: {
        select: {
          data: [
            { id: "job-1", title: "Ventas" },
            { id: "job-2", title: "Operaciones" },
          ],
          error: null,
        },
      },
      profiles: {
        select: {
          data: [{ id: "user-1", full_name: "Reclutador", role: "rh_recruiter" }],
          error: null,
        },
      },
    });
  });

  it("renderiza el pipeline y aplica filtros", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CrmDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Luis Soto")).toBeInTheDocument();

    const statusSelect = screen.getByLabelText("Estatus");
    await user.selectOptions(statusSelect, "to_call");

    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.queryByText("Luis Soto")).not.toBeInTheDocument();
  });
});
