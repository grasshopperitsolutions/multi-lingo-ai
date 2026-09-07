import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Deliberately separate from vite.config.js rather than a `test` block inside
// it. That file conditionally loads the Sentry plugin and sets `sourcemap`
// from CI-only env vars; none of it applies to a test run, and importing it
// here would mean every future build tweak silently changes how tests execute.
export default defineConfig({
  plugins: [react()],
  // Vite's own build gets this from @vitejs/plugin-react, but esbuild still
  // pre-transforms files it handles first and defaults to the classic runtime,
  // which needs `React` in scope. Every file here uses the modern transform.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.js"],
    // Rendering the real page tree pulls in lazy chunks and firebase; the
    // default 5s is tight enough to flake on a cold CI runner.
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/**/*.test.{js,jsx}", "src/main.jsx", "src/locales/**"],
    },
  },
});
