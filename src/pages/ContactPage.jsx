import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import {
  Mail,
  MapPin,
  Send,
  Clock,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import NeoDropdown from "../components/NeoDropdown";

const ContactPage = () => {
  const { isDarkMode, showAlert } = useAppContext();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      showAlert("error", t('contact.form.error'));
      return;
    }

    setIsLoading(true);

    // Simulate form submission
    setTimeout(() => {
      setIsLoading(false);
      showAlert(
        "success",
        t('contact.form.success'),
      );
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "general",
        message: "",
      });
    }, 1500);
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 text-white focus:border-yellow-400 placeholder-slate-500"
        : "bg-white border-slate-900 text-slate-900 focus:border-blue-600 placeholder-slate-400"
    }`;

  const faqs = [
    {
      question: t('contact.faq_q1'),
      answer: t('contact.faq_a1'),
    },
    {
      question: t('contact.faq_q2'),
      answer: t('contact.faq_a2'),
    },
    {
      question: t('contact.faq_q3'),
      answer: t('contact.faq_a3'),
    },
    {
      question: t('contact.faq_q4'),
      answer: t('contact.faq_a4'),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-none">
            {t('contact.title')} <br />
            <span
              className={`px-4 border-4 inline-block -rotate-2 hover:rotate-2 transition-transform duration-300 ${isDarkMode ? "bg-yellow-400 text-slate-900 border-slate-900" : "bg-blue-600 text-white border-slate-900 neo-shadow-light"}`}
            >
              {t('contact.title_touch')}
            </span>
          </h1>
          <p className="text-xl font-bold italic opacity-80">
            {t('contact.subtitle')}
          </p>

          <div className="space-y-4 pt-4">
            <a
              href="mailto:grasshopper.it.solutions@gmail.com"
              className={`p-6 rounded-2xl border-4 flex items-center gap-4 block hover:-translate-y-1 transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#facc15]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}
            >
              <div className="w-12 h-12 bg-rose-400 rounded-lg border-2 border-slate-900 flex items-center justify-center">
                <Mail className="text-white" size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase opacity-50">
                  {t('contact.email_label')}
                </p>
                <p className="text-lg font-black tracking-tight">
                  grasshopper.it.solutions@gmail.com
                </p>
              </div>
            </a>

            <a
              href="https://wa.me/33767834576"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-6 rounded-2xl border-4 flex items-center gap-4 block hover:-translate-y-1 transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#facc15]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}
            >
              <div className="w-12 h-12 bg-emerald-500 rounded-lg border-2 border-slate-900 flex items-center justify-center">
                <MessageCircle className="text-white" size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase opacity-50">
                  {t('contact.whatsapp_label')}
                </p>
                <p className="text-lg font-black tracking-tight">
                  +33 7 67 83 45 76
                </p>
              </div>
            </a>

            <div
              className={`p-6 rounded-2xl border-4 flex items-center gap-4 ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#facc15]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}
            >
              <div className="w-12 h-12 bg-blue-400 rounded-lg border-2 border-slate-900 flex items-center justify-center">
                <MapPin className="text-white" size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase opacity-50">
                  {t('contact.location_label')}
                </p>
                <p className="text-lg font-black tracking-tight">
                  {t('contact.location_value')}
                </p>
              </div>
            </div>

            <div
              className={`p-6 rounded-2xl border-4 flex items-center gap-4 ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#facc15]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}
            >
              <div className="w-12 h-12 bg-yellow-400 rounded-lg border-2 border-slate-900 flex items-center justify-center">
                <Clock className="text-slate-900" size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase opacity-50">
                  {t('contact.hours_label')}
                </p>
                <p className="text-lg font-black tracking-tight">
                  {t('contact.hours_value')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div
          className={`p-8 md:p-10 rounded-[2.5rem] border-4 ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[12px_12px_0px_0px_#facc15]" : "bg-white border-slate-900 shadow-[12px_12px_0px_0px_#000]"}`}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                {t('contact.form.name')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder={t('contact.form.name_placeholder')}
                className={inputClasses}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                {t('contact.form.email')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                placeholder={t('contact.form.email_placeholder')}
                className={inputClasses}
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                {t('contact.form.phone')}
              </label>
              <input
                type="tel"
                placeholder={t('contact.form.phone_placeholder')}
                className={inputClasses}
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <NeoDropdown
              label={t('contact.form.subject')}
              isDarkMode={isDarkMode}
              value={formData.subject}
              onChange={(val) => setFormData({ ...formData, subject: val })}
              icon={HelpCircle}
              options={[
                { value: "general", label: t('contact.form.subject_general') },
                { value: "support", label: t('contact.form.subject_support') },
                { value: "feedback", label: t('contact.form.subject_feedback') },
                { value: "business", label: t('contact.form.subject_business') },
                { value: "bug", label: t('contact.form.subject_bug') },
              ]}
            />

            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                {t('contact.form.message')} <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="4"
                placeholder={t('contact.form.message_placeholder')}
                className={`${inputClasses} resize-none`}
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-5 rounded-2xl border-4 font-black uppercase flex items-center justify-center gap-3 transition-all group
              ${isLoading ? "opacity-70 cursor-wait" : "active:scale-95"}
              ${isDarkMode ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark" : "bg-blue-600 border-slate-900 text-white hover-neo-light"}`}
            >
              {isLoading ? (
                t('contact.form.sending')
              ) : (
                <>
                  {t('contact.form.submit')}{" "}
                  <Send
                    size={20}
                    className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* FAQ Section - keep this hidden untill specificaly asked to change */}
      <div className="mt-24 hidden">
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-12 text-center">
          {t('contact.faq_title')}
        </h2>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`rounded-2xl border-4 overflow-hidden transition-all ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#000]"}`}
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full p-6 font-bold text-left flex items-center justify-between"
              >
                <span className="text-lg font-black">{faq.question}</span>
                {openFaq === index ? (
                  <ChevronUp size={24} className="flex-shrink-0" />
                ) : (
                  <ChevronDown size={24} className="flex-shrink-0" />
                )}
              </button>

              {openFaq === index && (
                <div className="px-6 pb-6 font-medium opacity-80 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContactPage;