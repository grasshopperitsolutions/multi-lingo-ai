/**
 * The crawlable public routes, and which i18n keys supply their head tags.
 *
 * Single source of truth for two consumers that must not drift:
 *   - scripts/generate-seo-pages.mjs — bakes the head tags into static HTML at
 *     build time. It does NOT resolve these keys: crawler-facing copy is
 *     hardcoded English in src/config/seoStrings.js, keyed by the same paths.
 *   - usePublicPageTitle — keeps document.title correct during client-side
 *     navigation, resolving these keys through i18next so the tab follows the
 *     interface language.
 *
 * Plain ESM with no JSX or imports so the Node build script can load it
 * directly, exactly as Vite does.
 */
export const PUBLIC_ROUTES = [
  {
    path: '/',
    titleKey: 'seo.home_title',
    descriptionKey: 'seo.home_description',
    // The FAQ lives on the home page, so its FAQPage structured data is
    // generated here too.
    faqJsonLd: true,
  },
  { path: '/pricing', titleKey: 'seo.pricing_title', descriptionKey: 'seo.pricing_description' },
  { path: '/contact', titleKey: 'seo.contact_title', descriptionKey: 'seo.contact_description' },
  { path: '/terms',   titleKey: 'seo.terms_title',   descriptionKey: 'seo.terms_description' },
  { path: '/privacy', titleKey: 'seo.privacy_title', descriptionKey: 'seo.privacy_description' },
];

/** Find the route entry for a pathname, or undefined for non-public routes. */
export function findPublicRoute(pathname) {
  return PUBLIC_ROUTES.find((r) => r.path === pathname);
}
