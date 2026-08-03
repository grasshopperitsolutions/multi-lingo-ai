import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import SEOMeta from "../components/SEOMeta";

const PrivacyPage = () => {
  const { t } = useTranslation();
  const { interfaceLang } = useAppContext();
  return (
    <>
      <SEOMeta
        title="Privacy Policy | Multi Lingo AI"
        description="Read the Privacy Policy for Multi Lingo AI — learn how we collect, use, and protect your data while you learn a language with AI."
        path="/privacy"
        lang={interfaceLang}
      />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">{t("privacy.title")}</h1>

        <div className="space-y-8">
          <section>
            <p className="leading-relaxed opacity-90">{t("privacy.intro")}</p>
            <p className="leading-relaxed opacity-90 mt-4">{t("privacy.intro_disagree")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section1_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section1_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section2_title")}</h2>
            <h3 className="text-xl font-semibold mb-2">{t("privacy.section2_1_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_1_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section2_2_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_2_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section2_3_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_3_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section2_4_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_4_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section2_5_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_5_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section2_6_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_6_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section2_7_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section2_7_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section3_title")}</h2>
            <h3 className="text-xl font-semibold mb-2">{t("privacy.section3_1_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section3_1_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section3_2_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section3_2_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section3_3_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section3_3_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section3_4_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section3_4_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section3_5_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section3_5_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("privacy.section3_6_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("privacy.section3_6_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section4_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section4_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section5_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section5_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section6_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section6_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section7_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section7_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section8_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section8_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section9_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section9_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section10_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section10_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section11_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section11_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("privacy.section12_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("privacy.section12_text")}</p>
          </section>

          <p className="text-sm opacity-70 mt-12">{t("privacy.last_updated")}</p>
        </div>
      </div>
    </>
  );
};

PrivacyPage.propTypes = {
  children: PropTypes.node,
};

export default PrivacyPage;