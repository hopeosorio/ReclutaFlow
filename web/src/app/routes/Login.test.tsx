import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "./Login";

const useAuthMock = vi.fn();
const supabaseFetchMock = vi.fn();
const setSessionMock = vi.fn();

vi.mock("@/app/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      setSession: (...args: unknown[]) => setSessionMock(...args),
    },
  },
  supabaseFetch: (...args: unknown[]) => supabaseFetchMock(...args),
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
}));

function renderLogin(path = "/login?debug=1") {
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
    useAuthMock.mockReturnValue({ error: null });
  });

  it("muestra el panel de debug cuando debug=1", () => {
    renderLogin();
    expect(screen.getByText("Debug")).toBeInTheDocument();
    expect(screen.getByText(/Supabase URL/i)).toBeInTheDocument();
  });

  it("envía credenciales y guarda sesión", async () => {
    supabaseFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ access_token: "a", refresh_token: "b" }),
    });
    setSessionMock.mockResolvedValue({ error: null });

    renderLogin("/login");
    fireEvent.change(screen.getByPlaceholderText("rh@empresa.com"), {
      target: { value: "admin@correo.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => expect(supabaseFetchMock).toHaveBeenCalled());
    await waitFor(() => expect(setSessionMock).toHaveBeenCalled());
  });
});
