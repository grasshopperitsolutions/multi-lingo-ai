import { Helmet, HelmetProvider } from 'react-helmet-async';
import PropTypes from "prop-types";

const SEOMeta = ({ title, description, path = '', lang = 'en-US' }) => {
  const baseUrl = 'https://multi-lingo.online';

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Canonical URL */}
      <link rel="canonical" href={`${baseUrl}${path}`} />

      {/* hreflang alternates */}
      <link rel="alternate" hrefLang="en-US"    href={`${baseUrl}${path}`} />
      <link rel="alternate" hrefLang="pt-PT"    href={`${baseUrl}${path}`} />
      <link rel="alternate" hrefLang="es-ES"    href={`${baseUrl}${path}`} />
      <link rel="alternate" hrefLang="fr-FR"    href={`${baseUrl}${path}`} />
      <link rel="alternate" hrefLang="x-default" href={`${baseUrl}${path}`} />

      {/* Open Graph and Twitter Card tags are intentionally NOT rendered
          here — they live as static tags in index.html instead. Social
          share scrapers (Facebook, X, LinkedIn, WhatsApp, Slack, etc.)
          never execute JavaScript, so a Helmet-only version would never be
          seen by them, and rendering it here alongside the static one would
          just create duplicate tags with undefined precedence. */}
    </Helmet>
  );
};

SEOMeta.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  path: PropTypes.string,
  lang: PropTypes.string,
};

export const SEOProvider = ({ children }) => (
  <HelmetProvider>
    {children}
  </HelmetProvider>
);

SEOProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default SEOMeta;
