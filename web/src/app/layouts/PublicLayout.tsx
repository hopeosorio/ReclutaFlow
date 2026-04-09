import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

export default function PublicLayout() {
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      window.dispatchEvent(new Event('app-scroll'));

      const currentY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (currentY < 0 || currentY > maxScroll + 1) return;

      const diff = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      if (currentY > 80) {
        if (diff > 6) setNavHidden(true);
        else if (diff < -10) setNavHidden(false);
      } else {
        setNavHidden(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="app-container">
      {/* Dynamic Glow Elements */}
      <div style={{ position: 'fixed', top: '0', right: '0', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(61, 90, 254, 0.03) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '0', left: '0', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}></div>

      <nav className={`nav-pixel${navHidden ? ' nav-pixel--hidden' : ''}`}>
        <NavLink to="/" end>INICIO</NavLink>
        <NavLink to="/login">ACCESO</NavLink>
        <NavLink to="/apply">UNIRSE</NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
