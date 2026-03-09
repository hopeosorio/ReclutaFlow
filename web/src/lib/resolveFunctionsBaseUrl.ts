export function resolveFunctionsBaseUrl(
  supabaseUrl: string,
  rawFunctionsBaseUrl?: string,
  origin?: string,
) {
  const normalize = (value?: string) => (value ?? "").trim().replace(/\/+$/, "");
  const normalizedBase = normalize(rawFunctionsBaseUrl);
  const fallback = `${supabaseUrl}/functions/v1`;

  if (!normalizedBase) return fallback;

  const isAbsolute = /^https?:\/\//i.test(normalizedBase);
  if (!isAbsolute) return fallback;

  const normalizedOrigin = normalize(origin);
  if (normalizedOrigin && normalizedOrigin === normalizedBase) return fallback;

  return normalizedBase;
}
