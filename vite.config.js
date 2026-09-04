import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Source maps are uploaded to Sentry rather than published. Without them a
// production stack trace is a list of one-letter names in index-BuZbKCv2.js,
// which tells you nothing about which component failed. `hidden` generates
// the maps and omits the //# sourceMappingURL comment, so they exist for the
// upload but nothing points browsers (or anyone reading the deployed site)
// at them; the plugin deletes the .map files after uploading, so they never
// reach the gh-pages artifact either.
//
// The upload needs a token, an org and a project. Without all three the
// plugin is left out entirely and the build still succeeds — which is what
// makes local `npm run build` and any fork's CI work unchanged.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const uploadSourcemaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(uploadSourcemaps
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            telemetry: false,
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ],
  base: "/",
  build: {
    sourcemap: uploadSourcemaps ? "hidden" : false,
  },
});
