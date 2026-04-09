import { vi } from "vitest";

vi.mock("@fullcalendar/react", () => ({
  default: vi.fn(({ events }: { events?: { title: string }[] }) => (
    <div data-testid="fullcalendar">
      {(events ?? []).map((e, i) => (
        <div key={i} data-testid="fc-event">{e.title}</div>
      ))}
    </div>
  )),
}));
vi.mock("@fullcalendar/daygrid",     () => ({ default: {} }));
vi.mock("@fullcalendar/timegrid",    () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));
