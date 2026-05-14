import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  ssgOptions: {
    // Only pre-render public routes — dashboard/settings stay client-rendered
    includedRoutes(paths) {
      return paths.filter((p) =>
        ["/", "/login", "/terms", "/privacy", "/contact"].includes(p)
      );
    },
    formatting: "minify",
  },
});
