import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Compass } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <section 
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Background ambient glow */}
      <div style={{
        position: "absolute",
        top: "10%",
        left: "20%",
        width: "50vw",
        height: "50vw",
        background: "var(--accent)",
        opacity: "0.05",
        filter: "blur(100px)",
        pointerEvents: "none",
        borderRadius: "50%"
      }} />
      <div style={{
        position: "absolute",
        bottom: "-10%",
        right: "10%",
        width: "40vw",
        height: "40vw",
        background: "#8b5cf6",
        opacity: "0.05",
        filter: "blur(100px)",
        pointerEvents: "none",
        borderRadius: "50%"
      }} />

      <div 
        className="card" 
        style={{ 
          maxWidth: '460px', 
          width: '100%', 
          padding: '3.5rem 2.5rem', 
          textAlign: 'center',
          backdropFilter: 'blur(12px)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--accent)',
              filter: 'blur(15px)',
              opacity: 0.3,
              borderRadius: '50%',
              animation: 'pulse 3s infinite'
            }} />
            <div style={{
              width: '90px',
              height: '90px',
              background: 'var(--bg-pure)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--border)',
              position: 'relative',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
            }}>
              <Compass size={40} strokeWidth={1.5} color="var(--accent)" />
            </div>
            {/* Pequeña insignia flotante 404 */}
            <div style={{
              position: 'absolute',
              bottom: '-5px',
              right: '-10px',
              background: 'var(--accent)',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: 900,
              padding: '4px 8px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              transform: 'rotate(12deg)'
            }}>
              404
            </div>
          </div>
        </div>

        <h1 
          style={{ 
            fontSize: '1.875rem', 
            fontWeight: 900, 
            letterSpacing: '-0.025em', 
            color: 'var(--text-main)', 
            marginBottom: '0.75rem',
            lineHeight: 1.1
          }}
        >
          Página no encontrada
        </h1>
        
        <p 
          style={{ 
            color: 'var(--text-muted)', 
            fontSize: '0.875rem', 
            lineHeight: 1.6, 
            marginBottom: '2.5rem' 
          }}
        >
          Lo sentimos, parece que la ruta a la que intentas acceder no existe, ha sido movida o no cuenta con los permisos necesarios.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => navigate(-1)}
              className="btn btn-ghost"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem' }}
            >
              <ArrowLeft size={16} />
              <span>Regresar</span>
            </button>
            <button 
              onClick={() => navigate("/")}
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.875rem', boxShadow: '0 10px 15px -3px rgba(61, 90, 254, 0.2)' }}
            >
              <Home size={16} />
              <span>Ir al inicio</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
