import { useEffect, useRef, useState } from "react";

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
}

function getPoint(event: PointerEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export default function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const { width, height } = parent.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000000"; // Dark for clear signature contrast
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);

    return () => observer.disconnect();
  }, []);

  // Redraw when value changes (e.g. initial load)
  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ratio = window.devicePixelRatio || 1;
      ctx.drawImage(img, 0, 0, canvas.width / ratio, canvas.height / ratio);
    };
    img.src = value;
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only left click / primary touch
      setIsDrawing(true);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const point = getPoint(e, canvas);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawing) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const point = getPoint(e, canvas);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDrawing) return;
      setIsDrawing(false);
      canvas.releasePointerCapture(e.pointerId);
      const dataUrl = canvas.toDataURL("image/png");
      onChange(dataUrl);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDrawing, onChange]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="signature-container" ref={containerRef} style={{ position: 'relative', width: '100%', height: '180px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ touchAction: 'none', display: 'block', cursor: 'crosshair' }}
      />
      <button
        type="button"
        onClick={handleClear}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '4px 12px',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#64748b',
          transition: 'all 0.2s ease',
          zIndex: 10
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ef4444'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.color = '#64748b'; }}
      >
        Limpiar
      </button>
      {!value && !isDrawing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.3 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Firme aquí</span>
        </div>
      )}
    </div>
  );
}

