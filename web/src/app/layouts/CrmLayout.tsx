import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/app/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "@/components/NotificationBell";
import { ToastContainer } from "@/components/Toast";
import { useToast } from "@/lib/hooks/useToast";
import { createContext, useContext, useState, useCallback } from "react";
import { LayoutDashboard, CalendarDays, Settings2, LogOut, ChevronRight } from "lucide-react";
import InteractiveStars from "@/components/InteractiveStars";

// ── Toast context ──────────────────────────────────────────────────────────────
interface ToastContextValue {
  toast: ReturnType<typeof useToast>["toast"];
}
const ToastContext = createContext<ToastContextValue>({ toast: { success: () => { }, error: () => { }, info: () => { }, warning: () => { } } });
export const useAppToast = () => useContext(ToastContext);

// ── Breadcrumb context ─────────────────────────────────────────────────────────
export interface BreadcrumbItem {
  label: string;
  to?: string;
}
interface BreadcrumbContextValue {
  crumbs: BreadcrumbItem[];
  setCrumbs: (items: BreadcrumbItem[]) => void;
}
const BreadcrumbContext = createContext<BreadcrumbContextValue>({ crumbs: [], setCrumbs: () => { } });
export const useCrumbs = () => useContext(BreadcrumbContext);

// ── Route → default breadcrumbs ────────────────────────────────────────────────
function defaultCrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname.startsWith("/crm/applications/")) return [{ label: "Pipeline", to: "/crm" }, { label: "Candidato" }];
  if (pathname.startsWith("/crm/interviews")) return [{ label: "Entrevistas" }];
  if (pathname.startsWith("/crm/admin")) return [{ label: "Administración" }];
  return [{ label: "Pipeline" }];
}

export default function CrmLayout() {
  const { profile, session } = useAuth();
  const { toasts, dismissToast, toast } = useToast();
  const location = useLocation();
  const [crumbs, setCrumbs] = useState<BreadcrumbItem[]>([]);

  const setCrumbsStable = useCallback((items: BreadcrumbItem[]) => setCrumbs(items), []);

  const activeCrumbs = crumbs.length > 0 ? crumbs : defaultCrumbs(location.pathname);

  const navItems = [
    { to: "/crm", label: "Pipeline", icon: <LayoutDashboard size={20} />, roles: ["rh_admin", "rh_recruiter"], matchPaths: ["/crm", "/crm/applications/"] },
    { to: "/crm/interviews", label: "Entrevistas", icon: <CalendarDays size={20} />, roles: ["rh_admin", "rh_recruiter", "interviewer"], matchPaths: ["/crm/interviews"] },
    { to: "/crm/admin", label: "Admin", icon: <Settings2 size={20} />, roles: ["rh_admin"], matchPaths: ["/crm/admin"] },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <BreadcrumbContext.Provider value={{ crumbs: activeCrumbs, setCrumbs: setCrumbsStable }}>
        <div className="crm">
          <InteractiveStars />
          <aside className="sidebar">
            <div className="brand--sidebar">
              <div className="nav-icon"><div className="brand-mark" /></div>
              <span className="brand-label">Mewi Talent</span>
            </div>
            <nav className="sidebar-nav">
              {navItems
                .filter((item) => (profile ? item.roles.includes(profile.role) : false))
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={() => item.matchPaths.some(p =>
                      location.pathname === p || (p.endsWith('/') && location.pathname.startsWith(p))
                    ) ? "active" : ""}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </NavLink>
                ))}
            </nav>
            <div className="sidebar-footer">
              <button className="btn-ghost sidebar-signout" onClick={handleSignOut}>
                <span className="nav-icon"><LogOut size={18} /></span>
                <span className="nav-label">Cerrar sesión</span>
              </button>
            </div>
          </aside>

          <div className="crm-content">
            <header className="crm-topbar">
              <div>
                <h1>Mesa de Talento</h1>
                <nav className="crm-breadcrumb" aria-label="breadcrumb">
                  <Link to="/crm" className="crm-breadcrumb__item crm-breadcrumb__link">Inicio</Link>
                  {activeCrumbs.map((c, i) => {
                    const isLast = i === activeCrumbs.length - 1;
                    return (
                      <span key={i} style={{ display: 'contents' }}>
                        <ChevronRight size={11} className="crm-breadcrumb__sep" />
                        {isLast || !c.to
                          ? <span className="crm-breadcrumb__item crm-breadcrumb__current">{c.label}</span>
                          : <Link to={c.to} className="crm-breadcrumb__item crm-breadcrumb__link">{c.label}</Link>
                        }
                      </span>
                    );
                  })}
                </nav>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
      </BreadcrumbContext.Provider>
    </ToastContext.Provider>
  );
}
