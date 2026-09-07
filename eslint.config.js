import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      ".vscode/**",
      ".idea/**",
      "public/**",
      ".vite-react-ssg-temp/**",
      "**/*.min.js",
      "**/*.min.css",
      "**/*.log",
      "**/*.tmp",
      "**/*.swp",
      "**/*.swo",
      "**/SEOMeta.jsx",
      "**/*-ignore*",
    ],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Tests run in jsdom under Vitest: browser globals plus Node's, plus the
    // `describe`/`it`/`expect` set that `globals: true` injects. They are also
    // not application components, so the react/prop-types rule — which exists
    // to keep real components documented — only fires on throwaway probes.
    files: ["test/**/*.{js,jsx}", "vitest.config.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
    rules: {
      "react/prop-types": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Build tooling runs in Node, not the browser — `process` and friends are
    // globals here, not undefined variables.
    files: ["vite.config.js", "eslint.config.js", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
];
