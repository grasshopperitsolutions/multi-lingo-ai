import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./i18n.js";
import { SEOProvider } from "./components/SEOMeta";

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SEOProvider>
      <App />
    </SEOProvider>
  </StrictMode>,
  {
    routes: [
      { path: "/" },
      { path: "/login" },
      { path: "/terms" },
      { path: "/privacy" },
      { path: "/contact" },
      { path: "/dashboard" },
      { path: "/settings" },
    ],
  },
);
