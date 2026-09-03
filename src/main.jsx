import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import './i18n.js';

// No <HelmetProvider> here any more. Head tags for the public routes are baked
// into static HTML at build time by scripts/generate-seo-pages.mjs — see that
// file for why runtime injection was the wrong tool for a client-rendered SPA
// on GitHub Pages.
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
