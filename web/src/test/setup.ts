import "@testing-library/jest-dom";
import { vi } from "vitest";

// ── ResizeObserver ──────────────────────────────────────────────────────────
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── IntersectionObserver ────────────────────────────────────────────────────
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

// ── URL.createObjectURL ─────────────────────────────────────────────────────
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
}

// ── window.matchMedia ───────────────────────────────────────────────────────
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── scrollTo ────────────────────────────────────────────────────────────────
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

// ── HTMLCanvasElement.getContext ────────────────────────────────────────────
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  strokeRect: vi.fn(),
  drawImage: vi.fn(),
  scale: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  toDataURL: vi.fn(() => "data:image/png;base64,mock"),
  lineWidth: 1,
  lineCap: "round",
  strokeStyle: "#000",
  fillStyle: "#000",
  globalAlpha: 1,
  canvas: { width: 300, height: 150 },
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
