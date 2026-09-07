import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// ── Browser APIs jsdom does not implement ────────────────────────────────────
// Each one is used by real code in src/. Without these, a component that
// merely *touches* the API throws during render and the failure looks like a
// component bug rather than a missing environment shim.

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.speechSynthesis) {
  window.speechSynthesis = {
    speak: () => {},
    cancel: () => {},
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

if (!window.AudioContext) {
  window.AudioContext = class {
    createGain() {
      return { connect: () => {}, gain: { value: 1 } };
    }
    createOscillator() {
      return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0 } };
    }
    close() {
      return Promise.resolve();
    }
  };
}

if (!navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: () => Promise.resolve(), readText: () => Promise.resolve("") },
    configurable: true,
  });
}

// ── Network ──────────────────────────────────────────────────────────────────
// No test may reach the real proxy. An unmocked call fails loudly rather than
// hanging until the timeout, so the test that forgot to mock says so.
globalThis.fetch = vi.fn(() =>
  Promise.reject(new Error("Unmocked fetch — stub it in the test that needs it")),
);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
