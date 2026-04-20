import { useEffect, useRef } from "react";

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export default function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const hasMovedRef = useRef(false); // To track if actual drawing happened
  const rectRef = useRef<DOMRect | null>(null);
  const lastEmittedValueRef = useRef<string | null>(null);

  const redraw = (val: string | null, force = false) => {
    if (!force && val && val === lastEmittedValueRef.current) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    if (!val) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasMovedRef.current = false;
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ratio = window.devicePixelRatio || 1;
      ctx.drawImage(img, 0, 0, canvas.width / ratio, canvas.height / ratio);
      hasMovedRef.current = true;
    };
    img.src = val;
  };

  // Initialize and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d", { 
        desynchronized: false
      });
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#000000";
        ctxRef.current = ctx;
        
        // Forced redraw on mount/resize to restore signature even if value stays same
        if (value) redraw(value, true);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current!);

    return () => observer.disconnect();
  }, []); // Only on mount

  // Redraw when value changes
  useEffect(() => {
    redraw(value ?? null);
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawLine = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.lineTo(x, y);
      ctx.stroke();
      hasMovedRef.current = true;
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (disabled || e.button !== 0) return;
      
      isDrawingRef.current = true;
      rectRef.current = canvas.getBoundingClientRect();
      
      const ctx = ctxRef.current;
      if (!ctx) return;

      const x = e.clientX - rectRef.current.left;
      const y = e.clientY - rectRef.current.top;

      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current || !rectRef.current || !ctxRef.current) return;
      
      const ctx = ctxRef.current;
      
      // Support for high-refresh rate displays (less lag)
      if ((e as any).getCoalescedEvents) {
        const events = (e as any).getCoalescedEvents() as PointerEvent[];
        for (const event of events) {
          const x = event.clientX - rectRef.current.left;
          const y = event.clientY - rectRef.current.top;
          drawLine(ctx, x, y);
        }
      } else {
        const x = e.clientX - rectRef.current.left;
        const y = e.clientY - rectRef.current.top;
        drawLine(ctx, x, y);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      canvas.releasePointerCapture(e.pointerId);
      
      if (hasMovedRef.current) {
        const dataUrl = canvas.toDataURL("image/png");
        lastEmittedValueRef.current = dataUrl;
        onChange(dataUrl);
      } else {
        lastEmittedValueRef.current = null;
        onChange(null);
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerup", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onChange, disabled]);

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasMovedRef.current = false;
    lastEmittedValueRef.current = null;
    onChange(null);
  };

  return (
    <div 
      className="signature-container" 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '180px', 
        background: '#ffffff', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0', 
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          touchAction: 'none', 
          display: 'block', 
          cursor: 'crosshair',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      />
      <button
        type="button"
        onClick={handleClear}
        disabled={disabled}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '4px 12px',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: disabled ? '#f1f5f9' : 'rgba(255,255,255,0.9)',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? '#cbd5e1' : '#64748b',
          transition: 'all 0.2s ease',
          zIndex: 10
        }}
        onMouseOver={(e) => { 
          if (disabled) return;
          e.currentTarget.style.background = '#fff'; 
          e.currentTarget.style.color = '#ef4444'; 
        }}
        onMouseOut={(e) => { 
          if (disabled) return;
          e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; 
          e.currentTarget.style.color = '#64748b'; 
        }}
      >
        Limpiar
      </button>
      {!value && !isDrawingRef.current && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.3 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            {disabled ? "LECTURA PENDIENTE" : "Firme aquí"}
          </span>
        </div>
      )}
      {disabled && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.1)', cursor: 'not-allowed', zIndex: 5 }} />
      )}
    </div>
  );
}

