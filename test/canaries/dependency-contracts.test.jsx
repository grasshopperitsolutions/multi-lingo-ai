import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense, lazy } from "react";

/**
 * Contract canaries for the runtime dependencies Dependabot bumps.
 *
 * Each test pins one behaviour the app relies on but neither `npm run lint`
 * nor `npm run build` can see, because it only exists when code runs. The two
 * outages this project has had were both of exactly this shape: a major
 * version that still type-checks, still bundles, and behaves differently.
 *
 * When a Dependabot PR turns one of these red, that is the signal working —
 * read the library's migration notes rather than loosening the assertion.
 */

describe("react-router-dom", () => {
  it("renders the element matching the current path", () => {
    render(
      <MemoryRouter initialEntries={["/second"]}>
        <Routes>
          <Route path="/first" element={<p>first</p>} />
          <Route path="/second" element={<p>second</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("follows a <Navigate> redirect", () => {
    // App.jsx guards whole route subtrees this way; a change here logs users
    // out of the dashboard or, worse, stops gating it.
    render(
      <MemoryRouter initialEntries={["/old"]}>
        <Routes>
          <Route path="/old" element={<Navigate to="/new" replace />} />
          <Route path="/new" element={<p>arrived</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("arrived")).toBeInTheDocument();
  });

  it("exposes useNavigate as a callable hook", () => {
    let navigate;
    const Probe = () => {
      navigate = useNavigate();
      return null;
    };

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(typeof navigate).toBe("function");
  });
});

describe("react + Suspense", () => {
  it("resolves a lazily imported route component", async () => {
    // Every /dashboard route is React.lazy(). If Suspense resolution changes,
    // the dashboard renders its fallback forever and nothing throws.
    const Lazy = lazy(() => Promise.resolve({ default: () => <p>lazy-loaded</p> }));

    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy />
      </Suspense>,
    );

    expect(await screen.findByText("lazy-loaded")).toBeInTheDocument();
  });
});

describe("framer-motion", () => {
  it("renders motion.div as a real div with its children and className", () => {
    const { container } = render(
      <motion.div className="probe" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <span>animated child</span>
      </motion.div>,
    );

    expect(screen.getByText("animated child")).toBeInTheDocument();
    expect(container.querySelector("div.probe")).not.toBeNull();
  });

  it("renders AnimatePresence children while present", () => {
    render(
      <AnimatePresence>
        <motion.p key="a">present</motion.p>
      </AnimatePresence>,
    );

    expect(screen.getByText("present")).toBeInTheDocument();
  });
});

describe("i18next / react-i18next", () => {
  it("resolves a real pt-PT key through useTranslation", async () => {
    const { default: i18n } = await import("../../src/i18n");
    const { useTranslation, I18nextProvider } = await import("react-i18next");
    const { default: pt } = await import("../../src/locales/pt/translation.json");

    // Pick a key from the shipped bundle rather than hard-coding one, so this
    // survives copy edits and only fails when lookup itself breaks.
    const [group] = Object.keys(pt);
    const [leaf] = Object.entries(pt[group]).find(([, v]) => typeof v === "string");
    const expected = pt[group][leaf];

    const Probe = () => {
      const { t } = useTranslation();
      return <span data-testid="out">{t(`${group}.${leaf}`)}</span>;
    };

    render(
      <I18nextProvider i18n={i18n}>
        <Probe />
      </I18nextProvider>,
    );

    expect(screen.getByTestId("out")).toHaveTextContent(expected);
  });

  it("falls back to the base locale rather than rendering the raw key", async () => {
    const { default: i18n } = await import("../../src/i18n");

    // A key that exists nowhere must not render as "some.missing.key" in the
    // UI; fallbackLng is what prevents that, and it is easy to lose in a bump.
    expect(i18n.options.fallbackLng).toBeTruthy();
  });
});

describe("lucide-react", () => {
  it("exports every icon the app imports", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const lucide = await import("lucide-react");

    const named = new Set();
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.jsx?$/.test(entry.name)) continue;
        const src = fs.readFileSync(full, "utf8");
        const re = /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g;
        let m;
        while ((m = re.exec(src))) {
          m[1]
            .split(",")
            .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
            .filter(Boolean)
            .forEach((name) => named.add(name));
        }
      }
    };
    walk(path.resolve("src"));

    // lucide-react 1.x dropped every brand icon, which is how `Instagram`
    // disappeared. This names the missing ones instead of failing on the first.
    const missing = [...named].filter((name) => typeof lucide[name] === "undefined");
    expect(missing).toEqual([]);
    expect(named.size).toBeGreaterThan(0);
  });
});

describe("@sentry/react", () => {
  it("keeps the API surface src/sentry.js calls", async () => {
    const Sentry = await import("@sentry/react");

    for (const fn of ["init", "setUser", "captureException", "breadcrumbsIntegration"]) {
      expect(typeof Sentry[fn], `Sentry.${fn}`).toBe("function");
    }
  });
});

describe("firebase", () => {
  it("keeps the modular entry points the services import", async () => {
    const app = await import("firebase/app");
    const auth = await import("firebase/auth");

    expect(typeof app.initializeApp).toBe("function");
    expect(typeof auth.getAuth).toBe("function");
    expect(typeof auth.onAuthStateChanged).toBe("function");
    expect(typeof auth.signInWithPopup).toBe("function");
  });
});
