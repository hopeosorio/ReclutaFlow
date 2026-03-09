import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";
import { ToastContainer } from "@/components/Toast";
import { useToast } from "@/components/useToast";
import { createContext, useContext } from "react";

// Toast context so child routes can call toast()
interface ToastContextValue {
  toast: ReturnType<typeof useToast>["toast"];
}
const ToastContext = createContext<ToastContextValue>({ toast: { success: () => { }, error: () => { }, info: () => { }, warning: () => { } } });
export const useAppToast = () => useContext(ToastContext);

export default function CrmLayout() {
  const { profile, session } = useAuth();
  const { toasts, dismissToast, toast } = useToast();

  const navItems = [
    { to: "/crm", label: "Pipeline", roles: ["rh_admin", "rh_recruiter"] },
    { to: "/crm/interviews", label: "Entrevistas", roles: ["rh_admin", "rh_recruiter", "interviewer"] },
    { to: "/crm/admin", label: "Admin", roles: ["rh_admin"] },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="crm">
        <aside className="sidebar">
          <div className="brand--sidebar">
            <div className="brand-mark" />
            <span>Talent Engine</span>
          </div>
          <nav className="sidebar-nav">
            {navItems
              .filter((item) => (profile ? item.roles.includes(profile.role) : false))
              .map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/crm"}>
                  {item.label}
                </NavLink>
              ))}
          </nav>
          <div className="sidebar-footer">
            <button className="btn-ghost" onClick={handleSignOut} style={{ width: '100%', justifyContent: 'center' }}>
              Cerrar sesión
            </button>
          </div>
        </aside>
        <div className="crm-content">
          <header className="crm-topbar">
            <div>
              <h1>Mesa de Talento</h1>
              <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--accent)', marginBottom: 0 }}>SISTEMA DE GESTIÓN RH v2.4</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <button className="btn-ghost" style={{ fontSize: '0.6rem' }} onClick={() => window.print()}>
                Exportar Sistema
              </button>
              <NotificationBell />
              <div className="user-pill">
                <span className="dot" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{profile?.full_name ?? "RH"}</strong>
                  <small>{session?.user.email ?? ""}</small>
                </div>
              </div>
            </div>
          </header>
          <main className="crm-main">
            <Outlet />
          </main>
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ToastContext.Provider>
  );
}
