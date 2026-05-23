import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const PrivacyPage = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">{t('privacy.title')}</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">{t("privacy.section1_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("privacy.section1_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">
            {t("privacy.section2_title")}
          </h2>
          <p className="leading-relaxed opacity-90">
            {t("privacy.section2_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("privacy.section3_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("privacy.section3_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("privacy.section4_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("privacy.section4_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">
            {t("privacy.section5_title")}
          </h2>
          <p className="leading-relaxed opacity-90">
            {t("privacy.section5_text")}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">{t("privacy.section6_title")}</h2>
          <p className="leading-relaxed opacity-90">
            {t("privacy.section6_text")}
          </p>
        </section>

        <p className="text-sm opacity-70 mt-12">{t("privacy.last_updated")}</p>
      </div>
    </div>
  );
};

PrivacyPage.propTypes = {
  children: PropTypes.node,
};

export default PrivacyPage;