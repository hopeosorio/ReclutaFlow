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
  rpc: { data: unknown; error: unknown };
  session: { data: { session: unknown }; error: unknown };
};

const responses: Record<string, TableResponse> = {};
const config: MockConfig = {
  functionsInvoke: { data: { ok: true }, error: null },
  storageSignedUrl: { data: { signedUrl: "https://example.com/file" }, error: null },
  rpc: { data: null, error: null },
  session: { data: { session: { access_token: "mock-token" } }, error: null },
};

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
  config.rpc = { data: null, error: null };
  config.session = { data: { session: { access_token: "mock-token" } }, error: null };
  supabaseMock.from.mockClear();
  supabaseMock.functions.invoke.mockClear();
  supabaseMock.storage.from.mockClear();
  supabaseMock.rpc.mockClear();
}

function createBuilder(table: string) {
  const tableResponse = () => responses[table] ?? {};
  let mode = "select";

  const builder: Record<string, unknown> = {};

  const chainable = () => builder;

  // Chainable filter methods
  builder.select  = chainable;
  builder.eq      = chainable;
  builder.neq     = chainable;
  builder.order   = chainable;
  builder.limit   = chainable;
  builder.in      = chainable;
  builder.not     = chainable;
  builder.filter  = chainable;
  builder.gte     = chainable;
  builder.lte     = chainable;
  builder.is      = chainable;
  builder.contains = chainable;
  builder.ilike   = chainable;
  builder.or      = chainable;

  builder.update = () => { mode = "update"; return builder; };
  builder.delete = () => { mode = "delete"; return builder; };

  const resolveResponse = () => {
    const t = tableResponse();
    if (mode === "update") return t.update ?? { data: null, error: null };
    if (mode === "delete") return t.delete ?? { data: null, error: null };
    return t.select ?? t.single ?? { data: [], error: null };
  };

  builder.insert     = () => Promise.resolve(tableResponse().insert ?? { data: null, error: null });
  builder.upsert     = () => Promise.resolve(tableResponse().upsert ?? tableResponse().insert ?? { data: null, error: null });
  builder.single     = () => Promise.resolve(tableResponse().single ?? tableResponse().select ?? { data: null, error: null });
  builder.maybeSingle = () => Promise.resolve(tableResponse().single ?? tableResponse().select ?? { data: null, error: null });

  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(resolveResponse()).then(onFulfilled, onRejected);

  return builder;
}

// Realtime channel mock
function createChannelMock() {
  const ch: Record<string, unknown> = {};
  ch.on = () => ch;
  ch.subscribe = vi.fn(() => ch);
  return ch;
}

export const supabaseMock = {
  from: vi.fn((table: string) => createBuilder(table)),
  rpc: vi.fn(async () => config.rpc),
  channel: vi.fn(() => createChannelMock()),
  removeChannel: vi.fn(),
  auth: {
    getSession: vi.fn(async () => config.session),
    signOut: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => config.session),
    setSession: vi.fn(async () => ({ error: null })),
  },
  functions: {
    invoke: vi.fn(async () => config.functionsInvoke),
  },
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn(async () => config.storageSignedUrl),
      upload: vi.fn(async () => ({ data: { path: "mock/path" }, error: null })),
    })),
  },
};
