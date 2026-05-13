import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { SEOProvider } from './components/SEOMeta'

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SEOProvider>
      <App />
    </SEOProvider>
  </StrictMode>,
)
