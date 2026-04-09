import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Check } from "lucide-react";
import { marked } from "marked";
import SignaturePad from "./SignaturePad";
import type { PrivacyNotice } from "../types";

const SectionTitle = ({ mono, title }: { mono: string, title: string }) => (
  <div className="section-title-wrapper mb-8">
    <span className="mono color-accent">// {mono}</span>
    <h2 className="outfit-bold">{title}</h2>
  </div>
);

interface Step01ConsentProps {
  register: any;
  watch: any;
  setValue?: any;
  privacyNotice: PrivacyNotice | null;
  signatureValue: string | null;
  onSignatureChange: (v: string | null) => void;
  onScrollComplete?: () => void;
}

export default function Step01Consent({
  register,
  watch,
  privacyNotice,
  signatureValue,
  onSignatureChange,
  onScrollComplete
}: Step01ConsentProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [showReadWarning, setShowReadWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const signerName = watch("signer_name") || "";
  const isSigned = !!signatureValue;
  const nameWords = signerName.trim().split(/\s+/).filter(Boolean).length;
  const isNameValid = nameWords >= 3;
  const canAccept = hasScrolledToBottom && isSigned && isNameValid;
  const [showPulse, setShowPulse] = useState(false);

  // Success Pulse Handler (One-time trigger when all conditions are met)
  useEffect(() => {
    if (canAccept && !showPulse) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [canAccept]);

  // Optimized Scroll Handler
  const warnNeedScroll = useCallback(() => {
    if (hasScrolledToBottom) return;
    setShowReadWarning(true);
    setTimeout(() => setShowReadWarning(false), 3000);
  }, [hasScrolledToBottom]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current && !hasScrolledToBottom) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 30) {
        setHasScrolledToBottom(true);
        onScrollComplete?.();
      }
    }
  }, [hasScrolledToBottom, onScrollComplete]);

  const content = privacyNotice?.content_md || "";
  const contentHtml = useMemo(() => marked.parse(content) as string, [content]);

  return (
    <div className="flex-center step-enter">
      <div className="pro-card compact-card" style={{ maxWidth: '1250px', width: '100%', padding: '2rem' }}>
        <SectionTitle mono="LEGAL" title="AVISO DE PRIVACIDAD" />

        {/* PARTE 1: AVISO (SCROLL) */}
        <div className="scroll-section mb-6">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="legal-box scroll-styled"
            style={{
              maxHeight: '240px',
              overflowY: 'auto',
              fontSize: '0.82rem',
              color: 'var(--text-dim)',
              scrollBehavior: 'smooth',
              lineHeight: '1.6',
              background: 'rgba(0,0,0,0.2)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid var(--border-dim)',
              willChange: 'scroll-position',
              WebkitOverflowScrolling: 'touch'
            }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          <div className="flex justify-center items-center mt-4" style={{ minHeight: '1.2rem' }}>
            <div className={`transition-all duration-700 ${hasScrolledToBottom ? 'opacity-40' : 'opacity-100'}`}>
              <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 'bold', textAlign: 'center' }}>
                {hasScrolledToBottom ? (
                  <>AVISO LEÍDO INTEGRALMENTE</>
                ) : (
                  <>↓ DESPLÁZATE HASTA EL FINAL PARA HABILITAR LA FIRMA</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* PARTE 2: FIRMA (SE REVELA TRAS SCROLL) */}
        {showReadWarning && (
          <div className="mono" style={{
            marginBottom: '0.75rem', padding: '0.6rem 1rem', borderRadius: '8px',
            background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.4)',
            color: '#ff4d6d', fontSize: '0.7rem', textAlign: 'center',
            animation: 'fadeInDown 0.3s ease'
          }}>
            ↑ Primero debes leer el aviso completo hasta el final
          </div>
        )}
        <div
          className={`consent-signature-grid transition-all duration-700 ${hasScrolledToBottom ? 'opacity-100 scale-100' : 'opacity-10 grayscale blur-[2px]'}`}
          style={{ marginBottom: '2rem', position: 'relative' }}
        >
          {/* Overlay que intercepta clics antes de leer el aviso */}
          {!hasScrolledToBottom && (
            <div
              onClick={warnNeedScroll}
              style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'not-allowed' }}
            />
          )}

          <div className="signature-section">
            <label className="mono mb-2" style={{ fontSize: '0.65rem' }}>FIRMA DIGITAL</label>
            <div style={{ border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', transition: 'all 0.5s ease' }}>
              <SignaturePad value={signatureValue} onChange={onSignatureChange} disabled={!hasScrolledToBottom} />
            </div>
          </div>

          <div className="name-section" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label className="mono mb-2" style={{ fontSize: '0.65rem' }}>NOMBRE COMPLETO</label>
              <input
                className="glass-input"
                placeholder="NOMBRE Y APELLIDOS"
                style={{
                  fontSize: '1.5rem', padding: '1.5rem 0', textTransform: 'uppercase',
                  opacity: hasScrolledToBottom ? 1 : 0.5,
                  borderColor: nameTouched && !isNameValid ? 'var(--error, #ff4d6d)' : undefined,
                  outline: nameTouched && !isNameValid ? '1px solid var(--error, #ff4d6d)' : undefined,
                }}
                disabled={!hasScrolledToBottom}
                {...register("signer_name", { required: true })}
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register("signer_name").onChange(e);
                }}
                onBlur={() => setNameTouched(true)}
              />
              {nameTouched && !isNameValid && signerName.trim().length > 0 && (
                <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--error, #ff4d6d)', marginTop: '6px' }}>
                  Escribe tu nombre completo (nombre y ambos apellidos).
                </p>
              )}
            </div>

            {/* PART 3: FINAL CHECKBOX (FULL WIDTH) */}
            <div className={`consent-final-reveal transition-all duration-700 ${canAccept ? 'opacity-100 translate-y-0 success-glow' : 'opacity-20'}`}
              style={{ width: '100%' }}>
              <label className="checkbox" style={{
                display: 'flex', alignItems: 'center', gap: '1.5rem',
                background: canAccept ? 'rgba(61,90,254,0.1)' : 'rgba(255,255,255,0.02)',
                padding: '1.5rem',
                borderRadius: '16px', border: canAccept ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                cursor: canAccept ? 'pointer' : 'not-allowed',
                boxShadow: canAccept ? '0 10px 30px rgba(61, 90, 254, 0.2)' : 'none',
                width: '100%',
                animation: showPulse ? 'success-pulse 1.2s ease-out 1' : 'none' // Destello sutil único de 1.2s
              }}>
                <input
                  type="checkbox"
                  disabled={!canAccept}
                  {...register("consent.accepted", { required: true })}
                  style={{ width: '25px', height: '25px', accentColor: 'var(--accent)', cursor: canAccept ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                />
                <div>
                  <span className="outfit-bold" style={{ fontSize: '1rem', color: canAccept ? 'black' : 'gray', lineHeight: 1.2 }}>ACEPTO QUE HE LEÍDO Y ESTOY DE ACUERDO CON LA INFORMACIÓN PROPORCIONADA</span>
                  <p className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '4px' }}>ESTA ACCIÓN TIENE VALIDEZ LEGAL DE CONSENTIMIENTO EXPRESO.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* PASO 3: VALIDACIÓN GLOBAL (STATUS BAR) */}
        <div className="validation-footer" style={{ marginTop: '0.8rem' }}>
          <div className="validation-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            <div className="badge mono flex align-center gap-2" style={{
              opacity: hasScrolledToBottom ? 1 : 0.3,
              color: hasScrolledToBottom ? 'var(--accent)' : 'white',
              fontSize: '0.65rem', border: '1px solid currentColor',
              padding: '6px 14px', borderRadius: '6px',
              transition: 'all 0.3s ease',
              background: hasScrolledToBottom ? 'rgba(61,90,254,0.05)' : 'transparent'
            }}>
              {hasScrolledToBottom && <Check size={12} />}
              <span>LECTURA COMPLETA</span>
            </div>

            <div className="badge mono flex align-center gap-2" style={{
              opacity: isSigned ? 1 : 0.3,
              color: isSigned ? 'var(--accent)' : 'white',
              fontSize: '0.65rem', border: '1px solid currentColor',
              padding: '6px 14px', borderRadius: '6px',
              transition: 'all 0.3s ease',
              background: isSigned ? 'rgba(61,90,254,0.05)' : 'transparent'
            }}>
              {isSigned && <Check size={12} />}
              <span>FIRMA REGISTRADA</span>
            </div>

            <div className="badge mono" style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              opacity: isNameValid ? 1 : 0.3,
              color: isNameValid ? 'var(--accent)' : 'white',
              fontSize: '0.65rem', border: '1px solid currentColor',
              padding: '6px 14px', borderRadius: '6px',
              transition: 'all 0.3s ease',
              background: isNameValid ? 'rgba(61,90,254,0.05)' : 'transparent'
            }}>
              {isNameValid && <Check size={12} />}
              <span>NOMBRE COMPLETO</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .legal-box strong, .legal-box b { color: var(--text-main); font-weight: 700; }
        .legal-box h1, .legal-box h2, .legal-box h3 { color: var(--text-main); font-weight: 700; margin: 0.8em 0 0.3em; font-size: 0.9rem; }
        .legal-box p { margin: 0 0 0.6em; }
        .legal-box ul, .legal-box ol { padding-left: 1.4em; margin: 0.4em 0 0.6em; }
        .legal-box li { margin-bottom: 0.25em; }
        @keyframes pulse {
          0% { transform: translateY(0); }
          50% { transform: translateY(5px); }
          100% { transform: translateY(0); }
        }
        @keyframes success-pulse {
          0% { box-shadow: 0 0 0px var(--accent); }
          50% { box-shadow: 0 0 25px var(--accent-glow); }
          100% { box-shadow: 0 0 0px var(--accent); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
