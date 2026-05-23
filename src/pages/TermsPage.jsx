import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const TermsPage = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">{t('terms.title')}</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">{t("terms.section1_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("terms.section1_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("terms.section2_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("terms.section2_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("terms.section3_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("terms.section3_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("terms.section4_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("terms.section4_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("terms.section5_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("terms.section5_text")}
          </p>
        </section>

        <p className="text-sm opacity-70 mt-12">{t("terms.last_updated")}</p>
      </div>
    </div>
  );
};

TermsPage.propTypes = {
  children: PropTypes.node,
};

export default TermsPage;