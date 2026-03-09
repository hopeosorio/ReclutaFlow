import { createClient } from "@supabase/supabase-js";
import { resolveFunctionsBaseUrl } from "@/lib/resolveFunctionsBaseUrl";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

const DEFAULT_TIMEOUT_MS = 15000;
const authMemoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
})();

const authStorage = (() => {
  const canUseLocalStorage = typeof window !== "undefined";
  const localStorageRef = canUseLocalStorage ? window.localStorage : null;
  return {
    getItem: (key: string) => {
      const fallback = authMemoryStorage.getItem(key);
      if (!localStorageRef) return fallback;
      try {
        return localStorageRef.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    setItem: (key: string, value: string) => {
      authMemoryStorage.setItem(key, value);
      if (!localStorageRef) return;
      try {
        localStorageRef.setItem(key, value);
      } catch {
        // ignore storage errors and keep in-memory copy
      }
    },
    removeItem: (key: string) => {
      authMemoryStorage.removeItem(key);
      if (!localStorageRef) return;
      try {
        localStorageRef.removeItem(key);
      } catch {
        // ignore storage errors and keep in-memory copy
      }
    },
  };
})();

export const supabaseFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const abortAny = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  const signal = init?.signal && abortAny ? abortAny([init.signal, controller.signal]) : controller.signal;

  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: authStorage,
  },
  global: {
    fetch: supabaseFetch,
  },
});

const rawFunctionsBaseUrl = (import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined) ?? "";
const origin = typeof window !== "undefined" ? window.location.origin : undefined;

export const functionsBaseUrl = resolveFunctionsBaseUrl(supabaseUrl, rawFunctionsBaseUrl, origin);

if (import.meta.env.DEV) {
  (window as any).__supabase = supabase;
  (window as any).__supabaseUrl = supabaseUrl;
}
