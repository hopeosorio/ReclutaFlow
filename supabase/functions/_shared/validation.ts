export function requireFields(obj: Record<string, unknown>, fields: string[]): string[] {
  const missing: string[] = [];
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      missing.push(field);
    }
  }
  return missing;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function asString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}
