import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import type { ProfileRole } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";

interface RequireAuthProps {
  roles?: ProfileRole[];
}

export default function RequireAuth({ roles }: RequireAuthProps) {
  const { session, profile, loading, error } = useAuth();

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <section className="container narrow">
        <div className="card">
          <h2>Error de sesión</h2>
          <p className="error">{error}</p>
          <p>Intenta recargar la página o verifica la configuración de Supabase.</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (roles) {
    if (!profile) {
      return (
        <section className="container narrow">
          <div className="card">
            <h2>Acceso no configurado</h2>
            <p>No hay un perfil RH asociado a tu usuario.</p>
            <p className="lead">Pide al administrador que asigne tu rol en la tabla profiles.</p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                void supabase.auth.signOut();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </section>
      );
    }
    if (!roles.includes(profile.role)) {
      return (
        <section className="container narrow">
          <div className="card">
            <h2>Acceso restringido</h2>
            <p>Tu rol actual no tiene permisos para este módulo.</p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                void supabase.auth.signOut();
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </section>
      );
    }
  }

  return <Outlet />;
}
