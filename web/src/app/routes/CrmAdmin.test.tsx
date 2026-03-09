import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrmAdmin from "@/app/routes/CrmAdmin";
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

describe("CrmAdmin", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockResponses({
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
              status: "active",
            },
          ],
          error: null,
        },
      },
      recruit_document_types: {
        select: {
          data: [{ id: "doc-1", name: "cv", stage: "application", is_required: false }],
          error: null,
        },
      },
      recruit_message_templates: {
        select: {
          data: [
            {
              id: "tmpl-1",
              template_key: "reject_after_call",
              subject: "Gracias {name}",
              body_md: "Hola {name}",
              is_active: true,
            },
          ],
          error: null,
        },
      },
      recruit_template_variables: {
        select: {
          data: [
            {
              variable_key: "name",
              label: "Nombre del candidato",
              description: "Nombre completo",
              example_value: "Ana Sofia",
              is_active: true,
              sort_order: 1,
            },
          ],
          error: null,
        },
      },
      recruit_event_logs: {
        select: {
          data: [
            {
              id: "event-1",
              event_key: "status_changed",
              entity_type: "application",
              entity_id: "app-1",
              application_id: "app-1",
              template_id: null,
              metadata: { from_status_key: "new", to_status_key: "to_call" },
              created_at: "2026-03-04T00:00:00Z",
              profiles: { full_name: "RH Admin" },
              recruit_message_templates: null,
            },
          ],
          error: null,
        },
      },
      profiles: {
        select: {
          data: [{ id: "user-1", full_name: "RH Admin", role: "rh_admin" }],
          error: null,
        },
      },
      recruit_statuses: {
        select: {
          data: [
            { status_key: "new", label: "Solicitud", requires_reason: false, is_active: true, sort_order: 1 },
            { status_key: "to_call", label: "Por llamar", requires_reason: false, is_active: true, sort_order: 2 },
          ],
          error: null,
        },
      },
      recruit_status_transitions: {
        select: {
          data: [{ from_status_key: "new", to_status_key: "to_call", is_active: true, template_key: null }],
          error: null,
        },
      },
      recruit_screening_questions: { select: { data: [], error: null } },
    });
  });

  it("muestra el panel y permite cambiar de pestaña", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);

    expect(await screen.findByText("Configuración operativa")).toBeInTheDocument();
    expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Plantillas" }));
    expect(await screen.findByText("Plantillas de correo")).toBeInTheDocument();
    expect(screen.getByText("Datos para vista previa")).toBeInTheDocument();
    expect(screen.getAllByText("Vista previa").length).toBeGreaterThan(0);
    expect(screen.getByText("Hola Ana Sofia")).toBeInTheDocument();
    expect(screen.getByText("Catálogo de variables")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Estatus" }));
    expect(await screen.findByText("Reglas de transición")).toBeInTheDocument();
    expect(screen.getAllByText("Por llamar").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Métricas" }));
    expect(await screen.findByText("Métricas recientes")).toBeInTheDocument();
    expect(await screen.findByText("Cambio de estatus")).toBeInTheDocument();
  });
});
