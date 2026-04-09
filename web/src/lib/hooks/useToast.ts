import { useCallback, useState } from "react";
import type { ToastMessage, ToastType } from "@/components/Toast";

let toastIdCounter = 0;

export function useToast() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
        const id = `toast-${++toastIdCounter}`;
        setToasts((prev) => [...prev, { id, message, type, duration }]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = {
        success: (msg: string, duration?: number) => addToast(msg, "success", duration),
        error: (msg: string, duration?: number) => addToast(msg, "error", duration ?? 6000),
        info: (msg: string, duration?: number) => addToast(msg, "info", duration),
        warning: (msg: string, duration?: number) => addToast(msg, "warning", duration),
    };

    return { toasts, dismissToast, toast };
}
