import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SEOProvider } from './components/SEOMeta.jsx';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import './i18n.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SEOProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SEOProvider>
  </React.StrictMode>
);
