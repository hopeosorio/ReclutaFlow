import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { Profile, ProfileRole } from "@/lib/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: ProfileRole[]) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    const data = await fetchProfile(session.user.id);
    setProfile(data);
  }, [session]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout al iniciar sesión (auth.getSession).")), 8000),
          ),
        ]);
        const { data, error: sessionError } = result;
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
        }
        setSession(data.session ?? null);
        if (data.session?.user) {
          const dataProfile = await fetchProfile(data.session.user.id);
          if (active) setProfile(dataProfile);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Error desconocido";
          setError(`No se pudo conectar con Supabase: ${message}`);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const currentUser = session?.user?.id;
      const newUser = nextSession?.user?.id;

      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Si el usuario es el mismo y ya tenemos perfil, no activamos el loading global
      // para evitar parpadeos al recuperar el foco de la ventana.
      if (currentUser === newUser && profile) {
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') return;

      setLoading(true);
      fetchProfile(nextSession.user.id)
        .then((dataProfile) => {
          if (active) setProfile(dataProfile);
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Error desconocido";
          if (active) setError(`No se pudo actualizar la sesión: ${message}`);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const hasRole = useCallback(
    (roles: ProfileRole[]) => {
      if (!profile) return false;
      return roles.includes(profile.role);
    },
    [profile],
  );

  const value = useMemo(
    () => ({ session, profile, loading, error, refreshProfile, hasRole }),
    [session, profile, loading, error, refreshProfile, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
