/**
 * generate-seo-pages.mjs
 *
 * Post-build step: writes one static HTML file per public route, each with its
 * own <title>, meta description, canonical, Open Graph and Twitter tags baked
 * into the markup.
 *
 * Why this exists instead of react-helmet-async:
 *
 * This is a client-rendered SPA on GitHub Pages with no SSR. Tags injected at
 * runtime are only ever seen by crawlers that execute JavaScript. Googlebot
 * does, eventually, via a deferred render queue — but social scrapers
 * (Facebook, X, LinkedIn, WhatsApp, Slack) never do, and AI crawlers (GPTBot,
 * ClaudeBot, PerplexityBot) generally don't either. Baking the tags at build
 * time means every crawler sees the right thing in the first response, with no
 * JavaScript and no render delay.
 *
 * GitHub Pages serves dist/pricing/index.html for /pricing directly, so these
 * files are hit before the 404.html SPA fallback ever comes into play. The
 * fallback still handles unknown paths and any client-side route.
 *
 * Copy comes from src/config/seoStrings.js — hand-written English, not the
 * locale files. This output is only ever read by crawlers and social scrapers,
 * an audience that does not follow the interface language, so the marketing
 * pages present in English worldwide while the app itself localises.
 *
 * NOT handled here (deliberate, pending a separate decision):
 *   - hreflang alternates are emitted exactly as SEOMeta used to emit them.
 *     They are currently inert: every alternate points at the same URL because
 *     locale is chosen client-side, so search engines ignore the cluster.
 *     Preserved as-is so removing them stays a conscious choice.
 *   - Body prerendering. Crawlers still receive an empty <div id="root">, so
 *     llms.txt is doing the heavy lifting for AI engines.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_STRINGS, SEO_FAQS } from '../src/config/seoStrings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BASE_URL = 'https://multi-lingo.online';

/** Locales advertised as hreflang alternates. See the note above. */
const HREFLANG = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'x-default'];

/**
 * One entry per public route. `jsonLd` is optional extra structured data
 * appended to the page (the sitewide SoftwareApplication block already lives
 * in index.html and is inherited by every generated file).
 */
const ROUTES = [
  { path: '/',        title: SEO_STRINGS.home_title,     description: SEO_STRINGS.home_description,    jsonLd: faqPageSchema() },
  { path: '/pricing', title: SEO_STRINGS.pricing_title,  description: SEO_STRINGS.pricing_description },
  { path: '/contact', title: SEO_STRINGS.contact_title,  description: SEO_STRINGS.contact_description },
  { path: '/terms',   title: SEO_STRINGS.terms_title,    description: SEO_STRINGS.terms_description },
  { path: '/privacy', title: SEO_STRINGS.privacy_title,  description: SEO_STRINGS.privacy_description },
];

/**
 * FAQPage structured data for the home page, built from the same FAQ copy the
 * page renders. This used to be emitted by <FaqJsonLd> through Helmet, which
 * meant it never reached the DOM at all — baking it in restores it.
 */
function faqPageSchema() {
  const faqs = SEO_FAQS;
  if (!Array.isArray(faqs) || faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

/** Escape for use inside a double-quoted HTML attribute. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Rewrite the <head> of the built index.html for one route.
 *
 * The template already carries the correct tag set — this swaps the values
 * rather than assembling a head from scratch, so anything added to index.html
 * later (a verification meta, an analytics snippet) is inherited automatically
 * instead of being silently dropped.
 */
function buildHtml(template, route) {
  const url = `${BASE_URL}${route.path === '/' ? '/' : route.path}`;
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(route.title)}</title>`);

  const swapMeta = (selector, value) => {
    const re = new RegExp(`(<meta\\s+property="${selector}"\\s+content=")[^"]*(")`);
    if (re.test(html)) html = html.replace(re, `$1${attr(value)}$2`);
  };
  swapMeta('og:title', route.title);
  swapMeta('og:description', route.description);
  swapMeta('og:url', url);
  swapMeta('twitter:title', route.title);
  swapMeta('twitter:description', route.description);
  swapMeta('twitter:url', url);

  // description / canonical / hreflang were previously injected at runtime by
  // SEOMeta, so index.html has no placeholders for them — insert instead.
  const head = [
    `<meta name="description" content="${attr(route.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...HREFLANG.map((lng) => `<link rel="alternate" hreflang="${lng}" href="${url}" />`),
  ];

  if (route.jsonLd) {
    head.push(
      `<script type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>`
    );
  }

  return html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

const template = readFileSync(join(DIST, 'index.html'), 'utf8');

for (const route of ROUTES) {
  const html = buildHtml(template, route);
  const outPath =
    route.path === '/'
      ? join(DIST, 'index.html')
      : join(DIST, route.path.replace(/^\//, ''), 'index.html');

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  console.log(`  ${route.path.padEnd(10)} -> ${outPath.replace(DIST, 'dist')}`);
}

console.log(`[seo] wrote ${ROUTES.length} pre-tagged pages`);
