import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";

const useAuthMock = vi.fn();
const supabaseFetchMock = vi.fn();
const setSessionMock = vi.fn();

vi.mock("@/app/AuthProvider", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { setSession: (...args: unknown[]) => setSessionMock(...args) } },
  supabaseFetch: (...args: unknown[]) => supabaseFetchMock(...args),
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
}));

function renderLogin(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/crm" element={<div>CRM</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    supabaseFetchMock.mockReset();
    setSessionMock.mockReset();
    useAuthMock.mockReturnValue({ session: null, loading: false, error: null });
  });

  it("renderiza el formulario de login", async () => {
    renderLogin();
    expect(await screen.findByPlaceholderText("nombre@empresa.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("muestra el botón ENTRAR y título ACCESO", async () => {
    renderLogin();
    expect(await screen.findByRole("button", { name: /ENTRAR/i })).toBeInTheDocument();
    expect(screen.getByText(/ACCESO/i)).toBeInTheDocument();
  });

  it("cambia a modo candidato al hacer click en el tab Candidato", async () => {
    renderLogin();
    const candidatoBtn = await screen.findByRole("button", { name: /Candidato/i });
    fireEvent.click(candidatoBtn);
    // En modo candidato, aparece el campo de ID de seguimiento
    expect(screen.getByPlaceholderText(/ID DE SEGUIMIENTO/i)).toBeInTheDocument();
  });

  it("envía credenciales y establece sesión en login exitoso", async () => {
    supabaseFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ access_token: "a", refresh_token: "b" }),
    });
    setSessionMock.mockResolvedValue({ error: null });

    renderLogin();
    fireEvent.change(await screen.findByPlaceholderText("nombre@empresa.com"), { target: { value: "admin@correo.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /Ingresar|Entrar|ENTRAR|ACCEDER/i }));

    await waitFor(() => expect(supabaseFetchMock).toHaveBeenCalled());
  });

  it("muestra error cuando las credenciales son incorrectas", async () => {
    supabaseFetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ msg: "Credenciales inválidas." }),
    });

    renderLogin();
    fireEvent.change(await screen.findByPlaceholderText("nombre@empresa.com"), { target: { value: "mal@correo.com" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: /Ingresar|Entrar|ENTRAR|ACCEDER/i }));

    expect(await screen.findByText(/credenciales|error|ERR/i)).toBeInTheDocument();
  });
});
