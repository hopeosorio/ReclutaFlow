import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

const getSessionMock = vi.fn();
const onAuthStateChangeMock = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "1", role: "rh_admin", full_name: "Admin" }, error: null }),
        }),
      }),
    }),
  },
}));

function Probe() {
  const { loading, error, session } = useAuth();
  if (loading) return <div>loading</div>;
  if (error) return <div>{error}</div>;
  return <div>{session ? "session" : "no-session"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    onAuthStateChangeMock.mockReset();
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("expone sesión cuando getSession resuelve", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "1" } } },
      error: null,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("session")).toBeInTheDocument());
  });
});
