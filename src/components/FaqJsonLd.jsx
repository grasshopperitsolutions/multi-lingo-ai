import { Helmet } from "react-helmet-async";
import PropTypes from "prop-types";

/**
 * FaqJsonLd
 *
 * Renders a schema.org FAQPage JSON-LD block from the same faq data already
 * shown on the page (single source of truth — no content duplication).
 */
const FaqJsonLd = ({ faqs }) => {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
};

FaqJsonLd.propTypes = {
  faqs: PropTypes.arrayOf(
    PropTypes.shape({
      question: PropTypes.string.isRequired,
      answer: PropTypes.string.isRequired,
    }),
  ).isRequired,
};

export default FaqJsonLd;
