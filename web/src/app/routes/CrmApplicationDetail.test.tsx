import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CrmApplicationDetail from "@/app/routes/CrmApplicationDetail";
import {
  resetSupabaseMock,
  setSupabaseMockConfig,
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

describe("CrmApplicationDetail", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockConfig({ functionsInvoke: { data: { ok: true }, error: null } });
    setSupabaseMockResponses({
      recruit_applications: {
        single: {
          data: {
            id: "app-1",
            status_key: "new",
            status_reason: null,
            submitted_at: "2026-03-04T09:00:00Z",
            updated_at: "2026-03-04T09:10:00Z",
            assigned_to: null,
            traffic_light: null,
            recruit_job_postings: {
              id: "job-1",
              title: "Ventas",
              branch: "CDMX",
              area: "Comercial",
              employment_type: null,
            },
            recruit_candidates: {
              id: "cand-1",
              education_level: "Bachillerato",
              has_education_certificate: true,
              recruit_persons: {
                id: "person-1",
                first_name: "Ana",
                last_name: "Pérez",
                email: "ana@correo.com",
                phone: "555",
                address_line1: "Calle 1",
                city: "CDMX",
                state: "CDMX",
                postal_code: "00000",
              },
            },
            profiles: null,
          },
          error: null,
        },
      },
      recruit_statuses: {
        select: {
          data: [
            { status_key: "new", label: "Solicitud recibida", requires_reason: false },
            { status_key: "to_call", label: "Por llamar", requires_reason: false },
          ],
          error: null,
        },
      },
      recruit_status_transitions: {
        select: {
          data: [{ from_status_key: "new", to_status_key: "to_call" }],
          error: null,
        },
      },
      recruit_notes: { select: { data: [], error: null } },
      recruit_application_documents: { select: { data: [], error: null } },
      recruit_interviews: { select: { data: [], error: null } },
      recruit_onboarding_plans: { single: { data: null, error: null } },
      recruit_message_logs: { select: { data: [], error: null } },
      recruit_application_status_history: { select: { data: [], error: null } },
      recruit_rehire_flags: { select: { data: [], error: null } },
      profiles: {
        select: {
          data: [{ id: "user-1", full_name: "Reclutador", role: "rh_recruiter" }],
          error: null,
        },
      },
    });
  });

  it("permite cambiar el estatus con la función", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/crm/applications/app-1"]}>
        <Routes>
          <Route path="/crm/applications/:id" element={<CrmApplicationDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: "Actualizar estatus" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(supabaseMock.functions.invoke).toHaveBeenCalledWith("change_status", {
        body: expect.objectContaining({ application_id: "app-1", status_key: "to_call" }),
      });
    });
  });
});
