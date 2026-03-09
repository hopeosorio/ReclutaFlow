import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
};

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
    return (
        <div className="toast-container" aria-live="polite">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Animate in
        const showTimer = setTimeout(() => setVisible(true), 10);
        // Auto dismiss
        const duration = toast.duration ?? 4000;
        const dismissTimer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onDismiss(toast.id), 300);
        }, duration);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(dismissTimer);
        };
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <div
            className={`toast toast--${toast.type} ${visible ? "toast--visible" : ""}`}
            role="alert"
        >
            <span className="toast__icon">{icons[toast.type]}</span>
            <span className="toast__message">{toast.message}</span>
            <button
                className="toast__close"
                type="button"
                onClick={() => {
                    setVisible(false);
                    setTimeout(() => onDismiss(toast.id), 300);
                }}
                aria-label="Cerrar"
            >
                ✕
            </button>
        </div>
    );
}
