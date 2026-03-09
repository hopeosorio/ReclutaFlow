import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrmInterviews from "@/app/routes/CrmInterviews";
import {
  resetSupabaseMock,
  setSupabaseMockResponses,
  supabaseMock,
} from "@/test/supabaseMock";

vi.mock("@/app/AuthProvider", () => ({
  useAuth: () => ({ profile: { role: "interviewer", full_name: "Entrevistador", id: "int-1" } }),
}));

vi.mock("@/lib/supabaseClient", async () => {
  const { supabaseMock } = await import("@/test/supabaseMock");
  return { supabase: supabaseMock };
});

describe("CrmInterviews", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockResponses({
      recruit_interviews: {
        select: {
          data: [
            {
              id: "int-1",
              interview_type: "phone",
              scheduled_at: "2026-03-04T10:00:00Z",
              location: "Zoom",
              result: "pending",
              notes: null,
              recruit_applications: {
                id: "app-1",
                status_key: "to_call",
                recruit_job_postings: { title: "Ventas", branch: "CDMX" },
                recruit_candidates: {
                  recruit_persons: {
                    first_name: "Ana",
                    last_name: "Pérez",
                    email: "ana@correo.com",
                    phone: "555",
                  },
                },
              },
            },
          ],
          error: null,
        },
      },
    });
  });

  it("renderiza entrevistas asignadas", async () => {
    render(
      <MemoryRouter>
        <CrmInterviews />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText(/Ventas/)).toBeInTheDocument();
  });
});
