import { ViteReactSSG } from 'vite-react-ssg';
import App from './App.jsx';
import './index.css';
import './i18n.js';

export const createRoot = ViteReactSSG(
  {
    routes: [
      { path: '/*', Component: App },
    ],
  },
);
