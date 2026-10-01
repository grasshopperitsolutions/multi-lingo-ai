import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initSentry } from './sentry.js';
import { captureAcquisition } from './utils/acquisition.js';
import { reloadForNewVersion } from './utils/staleDeploy.js';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import './i18n.js';

// No <HelmetProvider> here any more. Head tags for the public routes are baked
// into static HTML at build time by scripts/generate-seo-pages.mjs — see that
// file for why runtime injection was the wrong tool for a client-rendered SPA
// on GitHub Pages.

// Before render, so a crash during the first paint is still reported.
initSentry();

// A lazily loaded file that a newer deploy has removed: reload once for the
// new version, instead of the error screen saying "something went wrong".
// Vite fires this for every dynamic import, pages and libraries alike. When
// the reload is refused (it was just tried, so the deploy itself is broken),
// the error goes on to the error screen as before. See utils/staleDeploy.js.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// Where this visit came from, kept for the tab's session and sent only with a
// sign-up (utils/acquisition.js). First touch: the page someone lands on.
captureAcquisition();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Last resort: catches anything that escapes the route-level boundary
        inside App, including a crash in AppProvider itself. */}
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
