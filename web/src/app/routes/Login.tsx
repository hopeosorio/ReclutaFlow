import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { supabase, supabaseAnonKey, supabaseFetch, supabaseUrl } from "@/lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const { error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRh, setIsRh] = useState(true);

  const signInWithPasswordRest = async (emailValue: string, passwordValue: string) => {
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Configuración de Supabase no encontrada.");
    const response = await supabaseFetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: emailValue, password: passwordValue }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.msg ?? "Credenciales inválidas.");

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });
    if (sessionError) throw sessionError;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRh) {
        await signInWithPasswordRest(email, password);
        navigate("/crm");
      } else {
        setError("Acceso temporalmente restringido por mantenimiento.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      paddingTop: '60px' // Espacio para el Navbar
    }}>
      <div className="pro-card animate-fade" style={{
        maxWidth: '400px',
        width: '90%',
        padding: '2rem',
        margin: '0 auto'
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <span className="mono" style={{ fontSize: '0.6rem' }}>// IDENTIFICACIÓN</span>
          <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>ACCESO.</h2>
        </div>

        <div style={{
          display: 'flex',
          gap: '1.5rem',
          borderBottom: '1px solid var(--border-dim)',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => setIsRh(true)}
            style={{
              background: 'none',
              color: isRh ? 'var(--text-main)' : 'var(--text-dim)',
              border: 'none',
              padding: '0.5rem 0',
              borderBottom: isRh ? '2px solid var(--accent)' : 'none',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: '0.75rem'
            }}
          >
            Socio RH
          </button>
          <button
            onClick={() => setIsRh(false)}
            style={{
              background: 'none',
              color: !isRh ? 'var(--text-main)' : 'var(--text-dim)',
              border: 'none',
              padding: '0.5rem 0',
              borderBottom: !isRh ? '2px solid var(--accent)' : 'none',
              fontWeight: 800,
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: '0.75rem'
            }}
          >
            Candidato
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <span className="mono" style={{ fontSize: '0.65rem', marginBottom: '0.4rem', display: 'block' }}>IDENTIFICADOR</span>
            <input
              className="glass-input"
              type="email"
              placeholder={isRh ? "nombre@empresa.com" : "usuario@email.com"}
              style={{ padding: '0.8rem' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {isRh ? (
            <div>
              <span className="mono" style={{ fontSize: '0.65rem', marginBottom: '0.4rem', display: 'block' }}>CONTRASEÑA</span>
              <input
                className="glass-input"
                type="password"
                placeholder="••••••••"
                style={{ padding: '0.8rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          ) : (
            <div>
              <span className="mono" style={{ fontSize: '0.65rem', marginBottom: '0.4rem', display: 'block' }}>ID DE FOLIO</span>
              <input
                className="glass-input"
                placeholder="ID DE SEGUIMIENTO (OPCIONAL)"
                style={{ padding: '0.8rem' }}
              />
            </div>
          )}

          {(error || authError) && (
            <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>
              ERR // {String(error || authError).toUpperCase()}
            </div>
          )}

          <button className="btn-magnetic" disabled={loading} style={{
            width: '100%',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            {loading ? "AUTENTICANDO..." : "ENTRAR"}
          </button>
        </form>
      </div>
    </section>
  );
}
