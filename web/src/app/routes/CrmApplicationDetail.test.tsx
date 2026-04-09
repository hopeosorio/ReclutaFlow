import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CrmApplicationDetail from "@/app/routes/CrmApplicationDetail";
import { resetSupabaseMock, setSupabaseMockConfig, setSupabaseMockResponses, supabaseMock } from "@/test/supabaseMock";

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

const APP_DATA = {
  id: "app-1",
  status_key: "new",
  status_reason: null,
  submitted_at: "2026-03-04T09:00:00Z",
  updated_at: "2026-03-04T09:10:00Z",
  assigned_to: null,
  traffic_light: null,
  suggested_slot_1: null,
  suggested_slot_2: null,
  suggested_slot_3: null,
  meet_link: null,
  recruit_job_postings: { id: "job-1", title: "Ventas", branch: "CDMX", area: "Comercial", employment_type: null },
  recruit_candidates: {
    id: "cand-1",
    education_level: "Bachillerato",
    has_education_certificate: true,
    recruit_persons: {
      id: "person-1",
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@mail.com",
      phone: "555",
      address_line1: "Calle 1",
      city: "CDMX",
      state: "CDMX",
      postal_code: "00000",
    },
  },
  profiles: null,
};

function setupMocks(appOverride = {}) {
  setSupabaseMockResponses({
    recruit_applications: { single: { data: { ...APP_DATA, ...appOverride }, error: null } },
    recruit_statuses: {
      select: {
        data: [
          { status_key: "new", label: "Nuevo Postulante", category: "pipeline", requires_reason: false },
          { status_key: "validation", label: "Validación", category: "pipeline", requires_reason: false },
          { status_key: "virtual_scheduled", label: "Reunión Virtual", category: "interview", requires_reason: false },
        ],
        error: null,
      },
    },
    recruit_status_transitions: {
      select: {
        data: [
          { from_status_key: "new", to_status_key: "validation", template_key: null },
          { from_status_key: "validation", to_status_key: "virtual_scheduled", template_key: null },
        ],
        error: null,
      },
    },
    recruit_notes: { select: { data: [], error: null } },
    recruit_application_documents: { select: { data: [], error: null } },
    recruit_document_types: { select: { data: [], error: null } },
    recruit_interviews: { select: { data: [], error: null } },
    recruit_onboarding_plans: { single: { data: null, error: null } },
    recruit_message_logs: { select: { data: [], error: null } },
    recruit_application_status_history: { select: { data: [], error: null } },
    recruit_rehire_flags: { select: { data: [], error: null } },
    profiles: { select: { data: [{ id: "u1", full_name: "Reclutador", role: "rh_recruiter" }], error: null } },
  });
}

function renderDetail(appId = "app-1") {
  return render(
    <MemoryRouter initialEntries={[`/crm/applications/${appId}`]}>
      <Routes>
        <Route path="/crm/applications/:id" element={<CrmApplicationDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CrmApplicationDetail", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setSupabaseMockConfig({ functionsInvoke: { data: { ok: true }, error: null } });
    setupMocks();
    // El componente usa fetch() directamente para change_status y send_email
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, email: { ok: true } }),
    }) as unknown as typeof fetch;
  });

  it("muestra el nombre del candidato tras cargar", async () => {
    renderDetail();
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
  });

  it("muestra el título y sucursal de la vacante", async () => {
    renderDetail();
    await screen.findByText("Ana Pérez");
    expect(screen.getAllByText(/Ventas/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CDMX/).length).toBeGreaterThan(0);
  });

  it("cambia a pestaña BITÁCORA", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText("Ana Pérez");
    const tab = screen.getAllByRole("button").find(b => b.textContent?.includes("BITÁCORA"));
    if (tab) await user.click(tab);
    // La pestaña notas muestra este texto cuando no hay observaciones
    expect(await screen.findByText(/Sin observaciones registradas/i)).toBeInTheDocument();
  });

  it("cambia a pestaña DOCUMENTACIÓN", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText("Ana Pérez");
    await user.click(screen.getByRole("button", { name: /DOCUMENTACIÓN/i }));
    expect(await screen.findByText(/Sin documentos|Documentos/i)).toBeInTheDocument();
  });

  it("invoca change_status al cambiar de estatus", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText("Ana Pérez");

    // El select de fase está en un panel colapsable "TRANSICIÓN MANUAL DE ESTADO"
    // Primero hay que expandirlo haciendo click en el botón toggle
    const toggleBtn = screen.getAllByRole("button").find(b =>
      b.textContent?.includes("TRANSICIÓN MANUAL DE ESTADO"),
    );
    expect(toggleBtn).toBeTruthy();
    await user.click(toggleBtn!);

    // Ahora el select de fase destino debería estar visible
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
    const phaseSelect = selects.find(s => s.querySelector('option[value="validation"]'));
    if (phaseSelect) {
      await user.selectOptions(phaseSelect, "validation");
    } else {
      await user.selectOptions(selects[0], "validation");
    }

    // Hacer submit del formulario
    const submitBtn = screen.getAllByRole("button").find(b =>
      /EJECUTAR TRANSICIÓN|PROCESANDO/i.test(b.textContent ?? ""),
    );
    if (submitBtn) await user.click(submitBtn);

    // El componente llama fetch() directamente (no supabase.functions.invoke)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("change_status"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("botón SOLICITAR DOCUMENTOS aparece en status documents_pending", async () => {
    resetSupabaseMock();
    setSupabaseMockConfig({ functionsInvoke: { data: { ok: true }, error: null } });
    setupMocks({ status_key: "documents_pending" });
    renderDetail();
    await screen.findByText("Ana Pérez");
    // El botón está en la pestaña DOCUMENTACIÓN; hay que navegar a ella primero
    const docsTab = screen.getByRole("button", { name: /DOCUMENTACIÓN/i });
    const user = userEvent.setup();
    await user.click(docsTab);
    expect(await screen.findByText(/SOLICITAR DOCUMENTOS/i)).toBeInTheDocument();
  });

  it("candidato rechazado no muestra botones de acción de avance", async () => {
    resetSupabaseMock();
    setSupabaseMockConfig({ functionsInvoke: { data: { ok: true }, error: null } });
    setupMocks({ status_key: "rejected" });
    renderDetail();
    await screen.findByText("Ana Pérez");
    expect(screen.queryByRole("button", { name: /Actualizar estatus/i })).not.toBeInTheDocument();
  });

  it("muestra email del candidato en el perfil", async () => {
    renderDetail();
    await screen.findByText("Ana Pérez");
    expect(screen.getByText("ana@mail.com")).toBeInTheDocument();
  });
});
