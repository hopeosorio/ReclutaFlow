import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing-godly">
      {/* Cinematic Hero */}
      <section className="container-full" style={{ padding: '25rem', minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '4rem', top: '50%', transform: 'translateY(-50%)', zIndex: 2 }}>
          <span className="mono reveal" style={{ animationDelay: '0.1s' }}>// ARQUITECTURA DE TALENTO</span>
          <h1 className="reveal" style={{ animationDelay: '0.2s' }}>
            DISEÑADO<br />
            <span style={{ color: 'var(--accent)' }}>PARA ESCALAR.</span>
          </h1>
          <p className="reveal" style={{
            marginTop: '3rem',
            fontSize: '1.2rem',
            color: 'var(--text-dim)',
            maxWidth: '500px',
            lineHeight: '1.6',
            animationDelay: '0.3s'
          }}>
            La infraestructura definitiva para el reclutamiento de alto rendimiento.
            Sin fricciones, sin ruido, solo talento puro.
          </p>
          <div className="reveal" style={{ marginTop: '4rem', animationDelay: '0.4s' }}>
            <Link to="/apply" className="btn-magnetic">
              Explorar Posiciones
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </Link>
            <Link to="/track" className="btn-ghost" style={{ marginTop: '1rem', marginLeft: '1rem', padding: '1.2rem 2.5rem' }}>
              Consultar Postulación
            </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="v-text">RECLUTAFLOW</div>

        {/* Glow Sphere */}
        <div style={{
          position: 'absolute',
          right: '5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '40vw',
          height: '40vw',
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none'
        }}></div>
      </section>

      {/* Ventajas Principales - High Performance Features */}
      <section className="container-full scroll-scale" style={{ padding: '4rem 4rem' }}>
        <span className="mono">// VENTAJAS CLAVE</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4rem', marginTop: '4rem' }}>
          <div style={{ gridColumn: 'span 7' }}>
            <h2 style={{ fontSize: '4rem', marginBottom: '2rem' }}>Filtrado de Precisión IQ.</h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', lineHeight: '1.8' }}>
              Nuestra arquitectura no solo recibe aplicaciones; las procesa mediante un sistema de screening dinámico que identifica los perfiles con mayor potencial de éxito técnico y cultural.
            </p>
          </div>
          <div style={{ gridColumn: 'span 5', borderLeft: '1px solid var(--border-dim)', paddingLeft: '4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ marginBottom: '3rem' }}>
              <span className="mono" style={{ fontSize: '0.6rem' }}>CONTROL DE FLUJO</span>
              <h4 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Visión 360 del Funnel.</h4>
            </div>
            <div>
              <span className="mono" style={{ fontSize: '0.6rem' }}>INTEGRIDAD DE DATOS</span>
              <h4 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Firma Digital Integrada.</h4>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Showcase */}
      <section className="container-full scroll-reveal">
        <div className="mono">// CAPACIDADES DEL SISTEMA</div>
        <div className="bento">
          <div className="bento-item scroll-scale" style={{ gridColumn: 'span 8', background: 'var(--bg-accent)' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Velocidad Terminal.</h2>
            <p style={{ color: 'var(--text-dim)', maxWidth: '400px' }}>
              Desde el primer contacto hasta el onboarding. Automatización inteligente que reduce la carga operativa drásticamente.
            </p>
          </div>
          <div className="bento-item scroll-scale" style={{ gridColumn: 'span 4' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>IA Prioritaria.</h2>
            <p style={{ color: 'var(--text-dim)' }}>
              Sourcing inteligente que detecta los patrones de éxito en tu organización.
            </p>
          </div>
          <div className="bento-item scroll-scale" style={{ gridColumn: 'span 4' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Privacidad.</h2>
            <p style={{ color: 'var(--text-dim)' }}>
              Cumplimiento legal total y flujo de consentimiento dinámico integrado.
            </p>
          </div>
          <div className="bento-item scroll-scale" style={{ gridColumn: 'span 8', background: 'var(--bg-accent)' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Análisis Profundo.</h2>
            <p style={{ color: 'var(--text-dim)', maxWidth: '500px' }}>
              Dashboards que transforman datos crudos en decisiones estratégicas. Visualiza tu funnel de talento como nunca antes.
            </p>
          </div>
        </div>
      </section>

      {/* La Visión - High Impact Quote */}
      <section className="container-full scroll-vision" style={{ padding: '6rem 4rem' }}>
        <span className="mono">// NUESTRA FILOSOFÍA</span>
        <h2 style={{
          fontSize: 'clamp(3rem, 10vw, 8rem)',
          maxWidth: '1200px',
          marginTop: '4rem',
          fontStyle: 'italic',
          color: 'var(--primary)'
        }}>
          "El talento no es un recurso que se gestiona, es una <span style={{ color: 'var(--accent)' }}>fuerza</span> que se libera."
        </h2>
        <div style={{ marginTop: '4rem', display: 'flex', justifyContent: 'flex-end' }}>
          <p className="mono" style={{ color: 'var(--text-dim)', maxWidth: '400px', textAlign: 'right' }}>
            Nuestra visión es transformar la arquitectura del reclutamiento en una obra de ingeniería invisible.
          </p>
        </div>
      </section>

      {/* Extreme CTA */}
      <section className="container-full scroll-cta" style={{ padding: '4rem 0 0' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="mono">// PRÓXIMOS PASOS</span>
          <h1 style={{ marginBottom: '4rem' }}>ÚNETE AL FUTURO.</h1>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', alignItems: 'center' }}>
            <Link to="/apply" className="btn-magnetic" style={{ padding: '2.5rem 6rem' }}>
              Empezar Ahora
            </Link>
          </div>
        </div>
      </section>

      {/* Infinite Keyword Marquee - Final Touch */}
      <section className="scroll-reveal">
        <div className="marquee">
          <div className="marquee-content">
            {['INNOVACIÓN', 'TALENTO', 'PRECISIÓN', 'EFICIENCIA', 'CULTURA', 'ÉXITO', 'CONEXIÓN', 'FUTURO'].map((word) => (
              <span key={word} style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-dark)', letterSpacing: '0.4em' }}>{word}</span>
            ))}
            {/* Duplicate for seamless loop */}
            {['INNOVACIÓN', 'TALENTO', 'PRECISIÓN', 'EFICIENCIA', 'CULTURA', 'ÉXITO', 'CONEXIÓN', 'FUTURO'].map((word) => (
              <span key={word + '-2'} style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-dark)', letterSpacing: '0.4em' }}>{word}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="container-full" style={{ paddingBottom: '4rem', paddingTop: '4rem', borderTop: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>RECLUTAFLOW.</div>
          <div style={{ display: 'flex', gap: '4rem' }}>
            <a href="#" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontWeight: 700 }}>TWITTER</a>
            <a href="#" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontWeight: 700 }}>LINKEDIN</a>
            <a href="#" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontWeight: 700 }}>GITHUB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
