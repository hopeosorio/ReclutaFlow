import { NavLink, Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="app-container">
      {/* Dynamic Glow Elements */}
      <div style={{ position: 'fixed', top: '0', right: '0', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(61, 90, 254, 0.03) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '0', left: '0', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}></div>

      <nav className="nav-pixel">
        <NavLink to="/" end>INICIO</NavLink>
        <NavLink to="/login">ACCESO</NavLink>
        <NavLink to="/apply">UNIRSE</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>

      {/* Global Grain Overlay is already in body::after from CSS */}
    </div>
  );
}
