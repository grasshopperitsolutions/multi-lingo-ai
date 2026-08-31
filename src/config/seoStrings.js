/**
 * Crawler-facing head copy for the public marketing pages, in English.
 *
 * Deliberately NOT in the locale files. These strings are read at build time by
 * scripts/generate-seo-pages.mjs and baked into the static HTML, which is all a
 * crawler or social scraper ever sees. That audience is not the signed-in user,
 * so it does not follow the interface language: the marketing site presents in
 * English worldwide, while the app itself localises.
 *
 * The locale files still carry `seo.*_title`, and they are not redundant —
 * usePublicPageTitle reads them so the browser tab follows the interface
 * language during client-side navigation. The split is intentional: the copy
 * here is canonical for crawlers, the locale copy is for the tab. If you
 * reword a title, reword it in both.
 *
 * `faqs` mirrors home.faqs and feeds the FAQPage structured data. Google wants
 * structured data to match what the page renders; an anonymous visitor lands in
 * en-US, so the English copy is the right match.
 *
 * Plain ESM with no imports so the Node build script can load it directly,
 * exactly as it loads publicRoutes.js.
 */
export const SEO_STRINGS = {
  home_title: "Multi Lingo AI | Practice any language, for real life",
  home_description: "A language practice companion, not another course. Slang, grammar and stories you'll actually use — alongside your teacher, class or app. Deepest support for Portuguese, English and Spanish.",
  pricing_title: "Pricing | Multi Lingo AI",
  pricing_description: "Compare Multi Lingo AI plans. Every plan has the same practice tools — what changes is how much you can practice each day. Free tier available.",
  contact_title: "Contact | Multi Lingo AI",
  contact_description: "Questions, feedback or support for Multi Lingo AI — the language practice companion built by a working tutor.",
  terms_title: "Terms of Service | Multi Lingo AI",
  terms_description: "Terms of Service for Multi Lingo AI, the language practice companion for learners of any language.",
  privacy_title: "Privacy Policy | Multi Lingo AI",
  privacy_description: "Privacy Policy for Multi Lingo AI — how your data is collected, used and protected while you practice a language.",
};

/** FAQ copy for the home page's FAQPage structured data. */
export const SEO_FAQS = [
  {
    question: "Are multiple languages supported?",
    answer: "Absolutely! We support a wide range of languages including European and Brazilian Portuguese, US and UK English, Spanish (Spain & Mexico), French, and German. No more settling for apps that only support one dialect!",
  },
  {
    question: "Do I need to know English to use this?",
    answer: "Nope! Multi Lingo AI is powered by an engine that translates and explains concepts using ANY starting language or dialect you provide.",
  },
  {
    question: "Do I need a teacher to use this?",
    answer: "No — plenty of people use it on its own. But it's built assuming you might have a teacher, a class, or another app, and it's designed to sit alongside them rather than compete.",
  },
  {
    question: "Does this replace my language app?",
    answer: "No. Those are good at structure and streaks. This is for the gaps they leave: the slang, the local expressions, and the thing your teacher explained that didn't quite stick.",
  },
  {
    question: "Why isn't there a course or a syllabus?",
    answer: "That's deliberate. Your teacher or your app owns the path you're on. This owns the practice — short sessions you can do whenever, in whatever order you need.",
  },
  {
    question: "What makes Multi Lingo AI different?",
    answer: "It's written by a working language tutor rather than generated wholesale. The grammar library comes from real lessons, and the focus is on language people actually use — slang, expressions and everyday situations, not textbook phrasing.",
  },
  {
    question: "Can I talk to a real human?",
    answer: "Not yet. Live sessions with verified tutors are planned, but they aren't available today — everything on the site right now is self-serve practice.",
  },
  {
    question: "How much does it cost?",
    answer: "There's a free tier you can use indefinitely, with a daily limit on AI-powered features. Paid plans raise or remove that limit. See the pricing page for current plans.",
  },
  {
    question: "Can I try it for free?",
    answer: "Absolutely! You can use our free tier to explore all features. Most learners start with our free plan to see if Multi Lingo AI is right for them.",
  },
  {
    question: "Is my learning data private?",
    answer: "Yes! Your privacy is important to us. All conversation data is encrypted and you maintain full control over your learning information.",
  },
];
