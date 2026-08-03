import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import SEOMeta from "../components/SEOMeta";

const TermsPage = () => {
  const { t } = useTranslation();
  const { interfaceLang } = useAppContext();
  return (
    <>
      <SEOMeta
        title="Terms of Service | Multi Lingo AI"
        description="Read the Terms of Service for Multi Lingo AI, the AI-powered platform for learning any language from any dialect you speak."
        path="/terms"
        lang={interfaceLang}
      />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">{t("terms.title")}</h1>

        <div className="space-y-8">
          <section>
            <p className="leading-relaxed opacity-90">{t("terms.intro")}</p>
            <p className="leading-relaxed opacity-90 mt-4">{t("terms.intro_agree")}</p>
            <p className="leading-relaxed opacity-90 mt-2">{t("terms.intro_disagree")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section1_title")}</h2>
            <h3 className="text-xl font-semibold mb-2">{t("terms.section1_1_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section1_1_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section1_2_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section1_2_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section1_3_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section1_3_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section2_title")}</h2>
            <h3 className="text-xl font-semibold mb-2">{t("terms.section2_1_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section2_1_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section2_2_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section2_2_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section2_3_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section2_3_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section2_4_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section2_4_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section3_title")}</h2>
            <h3 className="text-xl font-semibold mb-2">{t("terms.section3_1_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section3_1_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section3_2_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section3_2_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section3_3_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section3_3_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section4_title")}</h2>
            <h3 className="text-xl font-semibold mb-2">{t("terms.section4_1_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section4_1_text")}</p>
            <h3 className="text-xl font-semibold mb-2 mt-4">{t("terms.section4_2_title")}</h3>
            <p className="leading-relaxed opacity-90">{t("terms.section4_2_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section5_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section5_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section6_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section6_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section7_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section7_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section8_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section8_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section9_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section9_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section10_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section10_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section11_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section11_text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">{t("terms.section12_title")}</h2>
            <p className="leading-relaxed opacity-90">{t("terms.section12_text")}</p>
          </section>

          <p className="text-sm opacity-70 mt-12">{t("terms.last_updated")}</p>
        </div>
      </div>
    </>
  );
};

TermsPage.propTypes = {
  children: PropTypes.node,
};

export default TermsPage;