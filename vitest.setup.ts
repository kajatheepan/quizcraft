import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

const storage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: storage,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

window.requestAnimationFrame = window.requestAnimationFrame ?? ((callback) => window.setTimeout(callback, 0));
window.cancelAnimationFrame = window.cancelAnimationFrame ?? ((id) => window.clearTimeout(id));

vi.mock("next/image", () => ({
  default: ({ alt = "", priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) =>
    React.createElement("img", { alt, ...props }),
}));
