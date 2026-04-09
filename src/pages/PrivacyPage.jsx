import React from "react";
import { useAppContext } from "../contexts/AppContext";

const PrivacyPage = () => {
  const { isDarkMode, t } = useAppContext();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
          <p className="leading-relaxed opacity-90">
            We may collect personal information such as your name, email address, and any other information you voluntarily provide when using our website.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
          <p className="leading-relaxed opacity-90">
            Any information we collect may be used to personalize your experience, improve our website, send periodic emails, or administer contests, promotions, surveys or other site features.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">3. Cookies</h2>
          <p className="leading-relaxed opacity-90">
            This website may use cookies to enhance user experience. Your web browser places cookies on your hard drive for record-keeping purposes and sometimes to track information about you. You may choose to set your browser to refuse cookies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">4. Data Protection</h2>
          <p className="leading-relaxed opacity-90">
            We adopt appropriate data collection, storage and processing practices and security measures to protect against unauthorized access, alteration, disclosure or destruction of your personal information stored on our site.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">5. Sharing Your Information</h2>
          <p className="leading-relaxed opacity-90">
            We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information regarding visitors and users with our business partners and advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">6. Changes to This Policy</h2>
          <p className="leading-relaxed opacity-90">
            We have the discretion to update this privacy policy at any time. When we do, we will revise the updated date at the bottom of this page. You acknowledge and agree that it is your responsibility to review this privacy policy periodically and become aware of modifications.
          </p>
        </section>

        <p className="text-sm opacity-70 mt-12">
          Last updated: April 2026
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;