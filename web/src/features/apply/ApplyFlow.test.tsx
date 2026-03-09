import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplyFlow from "@/features/apply/ApplyFlow";
import {
  resetSupabaseMock,
  setSupabaseMockResponses,
  supabaseMock,
} from "@/test/supabaseMock";

vi.mock("@/lib/supabaseClient", async () => {
  const { supabaseMock } = await import("@/test/supabaseMock");
  return {
    supabase: supabaseMock,
    functionsBaseUrl: "http://localhost/functions/v1",
  };
});

describe("ApplyFlow", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockResponses({
      recruit_privacy_notices: {
        single: { data: { id: "notice-1", content_md: "Aviso de privacidad" }, error: null },
      },
      recruit_job_postings: {
        select: {
          data: [
            {
              id: "job-1",
              title: "Ventas",
              branch: "CDMX",
              area: "Comercial",
              employment_type: null,
              description_short: "Atención a clientes",
            },
          ],
          error: null,
        },
      },
      recruit_document_types: {
        select: { data: [], error: null },
      },
      recruit_job_profiles: {
        single: {
          data: {
            role_summary: "Atiende clientes en tienda.",
            requirements: "Gusto por ventas",
            min_education: "Bachillerato",
            skills: "Comunicación",
            experience: "1 año",
            responsibilities: "Atender clientes",
            qualifications: "Manejo de caja",
            benefits: "Prestaciones",
            schedule: "Lunes a viernes",
            salary_range: "$10,000 - $12,000",
            location_details: "Sucursal Centro",
            growth_plan: "Plan interno",
          },
          error: null,
        },
      },
      recruit_screening_questions: {
        select: {
          data: [
            {
              id: "q-1",
              question_text: "¿Disponibilidad inmediata?",
              question_type: "boolean",
              options: null,
              is_required: true,
            },
          ],
          error: null,
        },
      },
    });
  });

  it("avanza por pasos con validaciones", async () => {
    const user = userEvent.setup();
    render(<ApplyFlow />);

    expect(await screen.findByRole("heading", { name: "Aviso de privacidad" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Debes aceptar el aviso de privacidad.")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Acepto el aviso/i));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Elige la vacante")).toBeInTheDocument();

    const radio = screen.getByRole("radio", { name: /Ventas/i });
    await user.click(radio);

    expect(await screen.findByText("Perfil del puesto")).toBeInTheDocument();
    expect(screen.getByText("Gusto por ventas")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Tu información")).toBeInTheDocument();
    expect(screen.getByText("¿Disponibilidad inmediata?")).toBeInTheDocument();
  });
});
