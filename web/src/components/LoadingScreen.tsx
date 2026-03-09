export default function LoadingScreen({ label = "CARGANDO" }: { label?: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="elite-scanner"></div>
        <div className="glitch-wrapper">
          <p className="mono glitch-text" data-text={label.toUpperCase()}>
            {label.toUpperCase()}
          </p>
        </div>
        <div className="loading-bar-container">
          <div className="loading-bar-progress"></div>
        </div>
        <span className="mono" style={{ fontSize: '0.5rem', marginTop: '1rem', opacity: 0.5 }}>
          SISTEMA ELITE // ADQUISICIÓN DE TALENTO
        </span>
      </div>

      <style>{`
        .loading-overlay {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          overflow: hidden;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          position: relative;
        }

        .elite-scanner {
          width: 200px;
          height: 1px;
          background: var(--accent, #3d5afe);
          box-shadow: 0 0 20px 2px var(--accent, #3d5afe);
          position: absolute;
          top: -20px;
          animation: scan 2s var(--ease-in-out, ease-in-out) infinite;
        }

        @keyframes scan {
          0%, 100% { transform: translateY(0); opacity: 0; }
          50% { transform: translateY(100px); opacity: 1; }
        }

        .loading-bar-container {
          width: 240px;
          height: 2px;
          background: rgba(255,255,255,0.05);
          margin-top: 1rem;
          overflow: hidden;
          position: relative;
        }

        .loading-bar-progress {
          position: absolute;
          height: 100%;
          width: 40%;
          background: var(--accent, #3d5afe);
          box-shadow: 0 0 10px var(--accent, #3d5afe);
          animation: progress 1.5s infinite var(--ease-in-out, ease-in-out);
        }

        @keyframes progress {
          0% { left: -40%; }
          100% { left: 140%; }
        }

        .glitch-text {
          position: relative;
          font-weight: 900;
          font-size: 1.2rem;
          letter-spacing: 0.3em;
          color: #fff;
        }

        .glitch-text::before,
        .glitch-text::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #000;
        }

        .glitch-text::before {
          left: 2px;
          text-shadow: -1px 0 #ff00c1;
          clip: rect(44px, 450px, 56px, 0);
          animation: glitch-anim 5s infinite linear alternate-reverse;
        }

        .glitch-text::after {
          left: -2px;
          text-shadow: -1px 0 #00fff9;
          clip: rect(44px, 450px, 56px, 0);
          animation: glitch-anim2 5s infinite linear alternate-reverse;
        }

        @keyframes glitch-anim {
          0% { clip: rect(31px, 9999px, 94px, 0); }
          5% { clip: rect(70px, 9999px, 71px, 0); }
          10% { clip: rect(29px, 9999px, 83px, 0); }
          /* ... simplified for brevity ... */
          100% { clip: rect(67px, 9999px, 62px, 0); }
        }

        @keyframes glitch-anim2 {
          0% { clip: rect(65px, 9999px, 100px, 0); }
          100% { clip: rect(10px, 9999px, 15px, 0); }
        }
      `}</style>
    </div>
  );
}
