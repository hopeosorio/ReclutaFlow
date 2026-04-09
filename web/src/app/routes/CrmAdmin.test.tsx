import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrmAdmin from "@/app/routes/CrmAdmin";
import { resetSupabaseMock, setSupabaseMockConfig, setSupabaseMockResponses } from "@/test/supabaseMock";

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

function setupMocks() {
  setSupabaseMockResponses({
    recruit_job_postings: {
      select: {
        data: [{
          id: "job-1", title: "Ventas", branch: "CDMX", area: "Comercial",
          employment_type: null, description_short: "Atención", status: "active",
        }],
        error: null,
      },
    },
    recruit_job_profiles: { select: { data: [], error: null } },
    recruit_document_types: {
      select: { data: [{ id: "doc-1", name: "solicitud_empleo", label: "Solicitud", stage: "application", is_required: true }], error: null },
    },
    recruit_message_templates: {
      select: {
        data: [{
          id: "tmpl-1", template_key: "welcome_candidate",
          subject: "Bienvenido {name}", body_md: "Hola {name}", is_active: true,
        }],
        error: null,
      },
    },
    recruit_template_variables: {
      select: {
        data: [{ variable_key: "name", label: "Nombre", description: "Nombre del candidato", example_value: "Ana García", is_active: true, sort_order: 1 }],
        error: null,
      },
    },
    recruit_event_logs: {
      select: {
        data: [{
          id: "ev-1", event_key: "status_changed", entity_type: "application",
          entity_id: "app-1", application_id: "app-1", template_id: null,
          metadata: { from: "new", to: "validation" },
          created_at: "2026-03-04T00:00:00Z",
          profiles: { full_name: "Admin" },
          recruit_message_templates: null,
        }],
        error: null,
      },
    },
    profiles: {
      select: { data: [{ id: "u1", full_name: "Admin", role: "rh_admin" }], error: null },
    },
    recruit_statuses: {
      select: {
        data: [
          { status_key: "new", label: "Nuevo", requires_reason: false, is_active: true, sort_order: 10 },
          { status_key: "validation", label: "Validación", requires_reason: false, is_active: true, sort_order: 20 },
        ],
        error: null,
      },
    },
    recruit_status_transitions: {
      select: { data: [{ from_status_key: "new", to_status_key: "validation", is_active: true, template_key: null }], error: null },
    },
    recruit_screening_questions: { select: { data: [], error: null } },
    recruit_rehire_flags: { select: { data: [], error: null } },
    recruit_applications: { select: { data: [], error: null } },
  });
}

describe("CrmAdmin", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockConfig({ functionsInvoke: { data: { summary: { total_applications: 5, emails_sent: 3, emails_failed: 0, status_breakdown: [] }, recent_events: [] }, error: null } });
    setupMocks();
  });

  it("muestra pestaña Vacantes con datos por defecto", async () => {
    render(<CrmAdmin />);
    expect(await screen.findAllByText("Ventas")).not.toHaveLength(0);
  });

  it("cambia a pestaña Plantillas", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);
    await screen.findAllByText("Ventas");

    await user.click(screen.getByRole("button", { name: /Plantillas/i }));
    // El h3 del tab muestra "Plantillas de correo"
    expect(await screen.findByText(/Plantillas de correo/i)).toBeInTheDocument();
    // La lista muestra el template_key en el encabezado del acordeón (siempre visible)
    expect(screen.getByText("welcome_candidate")).toBeInTheDocument();
  });

  it("pestaña Plantillas muestra catálogo de variables", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);
    await screen.findAllByText("Ventas");

    await user.click(screen.getByRole("button", { name: /Plantillas/i }));
    expect(await screen.findByText(/Catálogo de variables/i)).toBeInTheDocument();
    // La etiqueta "Nombre" aparece varias veces (chips + tabla); verificar que al menos existe
    expect(screen.getAllByText("Nombre").length).toBeGreaterThan(0);
  });

  it("cambia a pestaña Estatus y muestra transiciones", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);
    await screen.findAllByText("Ventas");

    await user.click(screen.getByRole("button", { name: /Estatus/i }));
    expect(await screen.findByText(/Reglas de transición/i)).toBeInTheDocument();
    // "Validación" aparece en la tabla y en los selects; verificar que al menos existe
    expect(screen.getAllByText("Validación").length).toBeGreaterThan(0);
  });

  it("cambia a pestaña Métricas y muestra eventos recientes", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);
    await screen.findAllByText("Ventas");

    await user.click(screen.getByRole("button", { name: /Métricas/i }));
    expect(await screen.findByText(/Métricas recientes/i)).toBeInTheDocument();
  });

  it("cambia a pestaña Documentos", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);
    await screen.findAllByText("Ventas");

    await user.click(screen.getByRole("button", { name: /Documentos/i }));
    // El componente muestra doc.name en bold: "solicitud_empleo"
    expect(await screen.findByText("solicitud_empleo")).toBeInTheDocument();
  });

  it("cambia a pestaña Usuarios", async () => {
    const user = userEvent.setup();
    render(<CrmAdmin />);
    await screen.findAllByText("Ventas");

    await user.click(screen.getByRole("button", { name: /Usuarios/i }));
    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });
});
