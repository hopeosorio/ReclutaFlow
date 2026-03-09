import { vi } from "vitest";

type TableResponse = {
  select?: { data: unknown; error: unknown };
  single?: { data: unknown; error: unknown };
  insert?: { data: unknown; error: unknown };
  update?: { data: unknown; error: unknown };
  delete?: { data: unknown; error: unknown };
  upsert?: { data: unknown; error: unknown };
};

type MockConfig = {
  functionsInvoke: { data: unknown; error: unknown };
  storageSignedUrl: { data: { signedUrl?: string } | null; error: unknown };
};

const responses: Record<string, TableResponse> = {};
const config: MockConfig = {
  functionsInvoke: { data: { ok: true }, error: null },
  storageSignedUrl: { data: { signedUrl: "https://example.com/file" }, error: null },
};

function getTableResponse(table: string) {
  return responses[table] ?? {};
}

function defaultResponse() {
  return { data: [], error: null };
}

export function setSupabaseMockResponses(next: Record<string, TableResponse>) {
  Object.keys(responses).forEach((key) => delete responses[key]);
  Object.assign(responses, next);
}

export function setSupabaseMockConfig(next: Partial<MockConfig>) {
  Object.assign(config, next);
}

export function resetSupabaseMock() {
  Object.keys(responses).forEach((key) => delete responses[key]);
  config.functionsInvoke = { data: { ok: true }, error: null };
  config.storageSignedUrl = { data: { signedUrl: "https://example.com/file" }, error: null };
  supabaseMock.from.mockClear();
  supabaseMock.functions.invoke.mockClear();
  supabaseMock.storage.from.mockClear();
}

function createBuilder(table: string) {
  const tableResponse = getTableResponse(table);
  let builder: any;
  const resolveResponse = () => {
    if (builder._mode === "update") {
      return tableResponse.update ?? defaultResponse();
    }
    if (builder._mode === "delete") {
      return tableResponse.delete ?? defaultResponse();
    }
    return tableResponse.select ?? tableResponse.single ?? defaultResponse();
  };
  builder = {
    _mode: "select",
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(tableResponse.single ?? tableResponse.select ?? defaultResponse()),
    single: () => Promise.resolve(tableResponse.single ?? tableResponse.select ?? defaultResponse()),
    insert: () => Promise.resolve(tableResponse.insert ?? defaultResponse()),
    upsert: () => Promise.resolve(tableResponse.upsert ?? tableResponse.insert ?? defaultResponse()),
    update: () => {
      builder._mode = "update";
      return builder;
    },
    delete: () => {
      builder._mode = "delete";
      return builder;
    },
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolveResponse()).then(onFulfilled, onRejected),
  };
  return builder;
}

export const supabaseMock = {
  from: vi.fn((table: string) => createBuilder(table)),
  functions: {
    invoke: vi.fn(async () => config.functionsInvoke),
  },
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(async () => config.storageSignedUrl),
    })),
  },
};
