import { Helmet, HelmetProvider } from 'react-helmet-async';
import PropTypes from "prop-types";

const SEOMeta = ({ title, description, path = '', lang = 'en' }) => {
  const baseUrl = 'https://grasshoppersolutions.online/multi-lingo-ai';

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Canonical URL */}
      <link rel="canonical" href={`${baseUrl}${path}`} />

      {/* hreflang alternates */}
      <link rel="alternate" hreflang="en"        href={`${baseUrl}${path}`} />
      <link rel="alternate" hreflang="pt-PT"    href={`${baseUrl}${path}`} />
      <link rel="alternate" hreflang="es"        href={`${baseUrl}${path}`} />
      <link rel="alternate" hreflang="fr"        href={`${baseUrl}${path}`} />
      <link rel="alternate" hreflang="x-default" href={`${baseUrl}${path}`} />

      {/* Open Graph */}
      <meta property="og:title"       content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:locale"      content={lang.replace('-', '_')} />
      <meta property="og:url"         content={`${baseUrl}${path}`} />
    </Helmet>
  );
};

SEOMeta.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  path: PropTypes.string,
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
