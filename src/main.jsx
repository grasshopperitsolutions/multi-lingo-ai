import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { ViteSSG } from 'vite-ssg'
import App from './App.jsx'
import './index.css'
import './i18n.js'
import { SEOProvider } from './components/SEOMeta'

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SEOProvider>
    <App />
  </SEOProvider>,
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
  </StrictMode>,
)
