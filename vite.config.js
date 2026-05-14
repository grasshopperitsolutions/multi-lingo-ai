import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  ssgOptions: {
    // Pre-render only public-facing routes.
    // Auth-gated routes (login, dashboard, settings) stay client-rendered.
    // Terms and Privacy are included: they are public, linkable, and benefit
    // from being indexed by search engines.
    includedRoutes(paths) {
      return paths.filter((p) =>
        ["/", "/contact", "/terms", "/privacy"].includes(p)
      );
    },
  },
});
