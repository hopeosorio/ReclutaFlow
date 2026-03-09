import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";

const useAuthMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/app/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signOut: () => signOutMock(),
    },
  },
}));

function renderWithRoutes(roles?: ("rh_admin" | "rh_recruiter" | "interviewer")[]) {
  return render(
    <MemoryRouter initialEntries={["/crm"]}>
      <Routes>
        <Route element={<RequireAuth roles={roles} />}>
          <Route path="/crm" element={<div>CRM</div>} />
        </Route>
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    signOutMock.mockReset();
  });

  it("muestra loading mientras verifica sesión", () => {
    useAuthMock.mockReturnValue({ session: null, profile: null, loading: true, error: null });
    renderWithRoutes(["rh_admin"]);
    expect(screen.getByText("Verificando sesión")).toBeInTheDocument();
  });

  it("muestra error de sesión cuando AuthProvider falla", () => {
    useAuthMock.mockReturnValue({
      session: null,
      profile: null,
      loading: false,
      error: "falló",
    });
    renderWithRoutes(["rh_admin"]);
    expect(screen.getByText("Error de sesión")).toBeInTheDocument();
    expect(screen.getByText("falló")).toBeInTheDocument();
  });

  it("redirige a login si no hay sesión", () => {
    useAuthMock.mockReturnValue({ session: null, profile: null, loading: false, error: null });
    renderWithRoutes(["rh_admin"]);
    expect(screen.getByText("Login")).toBeInTheDocument();
  });

  it("muestra aviso si no existe perfil RH", () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: "1" } },
      profile: null,
      loading: false,
      error: null,
    });
    renderWithRoutes(["rh_admin"]);
    expect(screen.getByText("Acceso no configurado")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cerrar sesión"));
    expect(signOutMock).toHaveBeenCalled();
  });

  it("muestra aviso si el rol no tiene acceso", () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: "1" } },
      profile: { id: "1", role: "interviewer", full_name: "Test" },
      loading: false,
      error: null,
    });
    renderWithRoutes(["rh_admin"]);
    expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
  });

  it("permite acceso cuando el rol coincide", () => {
    useAuthMock.mockReturnValue({
      session: { user: { id: "1" } },
      profile: { id: "1", role: "rh_admin", full_name: "Test" },
      loading: false,
      error: null,
    });
    renderWithRoutes(["rh_admin"]);
    expect(screen.getByText("CRM")).toBeInTheDocument();
  });
});
