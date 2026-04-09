import { render, screen } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";

const useAuthMock = vi.fn();

vi.mock("@/app/AuthProvider", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { signOut: vi.fn(async () => ({ error: null })) } },
}));

function Protected({ roles }: { roles?: string[] }) {
  return (
    <MemoryRouter initialEntries={["/crm"]}>
      <Routes>
        <Route path="/login" element={<div>Login</div>} />
        <Route element={<RequireAuth roles={roles as any} />}>
          <Route path="/crm" element={<div>CRM</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  beforeEach(() => useAuthMock.mockReset());

  it("muestra null mientras carga", () => {
    useAuthMock.mockReturnValue({ loading: true, session: null, profile: null, error: null });
    const { container } = render(<Protected />);
    expect(container.firstChild).toBeNull();
  });

  it("redirige a /login si no hay sesión", () => {
    useAuthMock.mockReturnValue({ loading: false, session: null, profile: null, error: null });
    render(<Protected />);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("muestra contenido protegido con sesión válida y rol correcto", () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: "1" } },
      profile: { role: "rh_admin", full_name: "Admin" },
      error: null,
    });
    render(<Protected roles={["rh_admin"]} />);
    expect(screen.getByText("CRM")).toBeInTheDocument();
  });

  it("muestra acceso restringido cuando el rol no coincide", () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: "1" } },
      profile: { role: "interviewer", full_name: "Entrevistador" },
      error: null,
    });
    render(<Protected roles={["rh_admin"]} />);
    expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
  });

  it("muestra error de sesión cuando hay error", () => {
    useAuthMock.mockReturnValue({ loading: false, session: null, profile: null, error: "Token expirado" });
    render(<Protected />);
    expect(screen.getByText("Error de sesión")).toBeInTheDocument();
  });

  it("muestra 'Acceso no configurado' si hay sesión pero sin perfil", () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: "1" } },
      profile: null,
      error: null,
    });
    render(<Protected roles={["rh_admin"]} />);
    expect(screen.getByText("Acceso no configurado")).toBeInTheDocument();
  });

  it("permite acceso sin restricción de rol cuando roles es undefined", () => {
    useAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: "1" } },
      profile: { role: "interviewer", full_name: "Test" },
      error: null,
    });
    render(<Protected />);
    expect(screen.getByText("CRM")).toBeInTheDocument();
  });
});
