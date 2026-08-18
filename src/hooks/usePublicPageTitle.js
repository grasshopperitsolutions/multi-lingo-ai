import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { findPublicRoute } from "../config/publicRoutes";

/**
 * Keeps document.title correct while navigating between public pages.
 *
 * The static HTML generated at build time already carries the right <title>
 * for the first paint of any URL, which is all a crawler ever sees. This only
 * covers the gap after that: React Router navigations don't reload the
 * document, so without this the tab would keep showing whichever title the
 * page was originally served with.
 *
 * Deliberately limited to document.title. Meta description, canonical, OG and
 * Twitter tags are read exclusively from the initial HTML response — no
 * crawler benefits from mutating them client-side, so we don't.
 *
 * Re-runs on language change so the tab follows the interface language.
 */
export function usePublicPageTitle() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const route = findPublicRoute(pathname);
    if (route) document.title = t(route.titleKey);
  }, [pathname, t, i18n.language]);
}

export default usePublicPageTitle;
