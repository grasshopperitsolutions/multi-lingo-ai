import { ViteSSG } from 'vite-ssg';
import App from './App.jsx';
import './index.css';
import './i18n.js';
import { SEOProvider } from './components/SEOMeta';

export const createApp = ViteSSG(
  App,
  {
    routes: [
      { path: '/' },
      { path: '/login' },
      { path: '/terms' },
      { path: '/privacy' },
      { path: '/contact' },
      { path: '/dashboard' },
      { path: '/settings' },
    ],
  },
  ({ app }) => {
    app.component('SEOProvider', SEOProvider);
  },
);
