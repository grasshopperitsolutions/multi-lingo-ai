import React, { useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
  ArrowRight,
  Mail,
  MapPin,
  Phone,
  Send,
  Clock,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import NeoDropdown from "../components/NeoDropdown";

const ContactPage = () => {
  const { isDarkMode, showAlert } = useAppContext();
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
      showAlert("error", "Please fill all required fields");
      return;
    }

    setIsLoading(true);

    // Simulate form submission
    setTimeout(() => {
      setIsLoading(false);
      showAlert(
        "success",
        "Message sent successfully! We'll get back to you soon.",
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
      question: "How quickly will I get a reply?",
      answer:
        "We usually reply within 24 hours during business days. For urgent matters, use WhatsApp for fastest response.",
    },
    {
      question: "Do you offer custom plans for schools?",
      answer:
        "Yes! We have special educational packages for schools and language institutes. Send us a message to discuss your needs.",
    },
    {
      question: "Can I request new features?",
      answer:
        "Absolutely! We love hearing user suggestions. Many of our best features came directly from user requests.",
    },
    {
      question: "Is Nuno's Lingo really 100% remote?",
      answer:
        "Yes! We are a fully distributed team working from beaches, cafes and co-working spaces around the world. No office, no dress code, just great Portuguese learning.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-none">
            Get in <br />
            <span
              className={`px-4 border-4 inline-block -rotate-2 hover:rotate-2 transition-transform duration-300 ${isDarkMode ? "bg-yellow-400 text-slate-900 border-slate-900" : "bg-blue-600 text-white border-slate-900 neo-shadow-light"}`}
            >
              Touch
            </span>
          </h1>
          <p className="text-xl font-bold italic opacity-80">
            Got questions about European Portuguese? Our flock is here to help
            you soar.
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
                  Email us
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
                  WhatsApp (fastest reply)
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
                  Location
                </p>
                <p className="text-lg font-black tracking-tight">
                  🌍 Fully Remote & Worldwide
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
                  Working Hours
                </p>
                <p className="text-lg font-black tracking-tight">
                  🟢 24/7 / 365 Days
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
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Nuno Silva"
                className={inputClasses}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                placeholder="nuno@exemplo.pt"
                className={inputClasses}
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                placeholder="+33 6 12 34 56 78"
                className={inputClasses}
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            <NeoDropdown
              label="Subject"
              isDarkMode={isDarkMode}
              value={formData.subject}
              onChange={(val) => setFormData({ ...formData, subject: val })}
              icon={HelpCircle}
              options={[
                { value: "general", label: "General Question" },
                { value: "support", label: "Technical Support" },
                { value: "feedback", label: "Feedback" },
                { value: "business", label: "Business Enquiry" },
                { value: "bug", label: "Bug Report" },
              ]}
            />

            <div className="space-y-2">
              <label className="font-black uppercase text-xs tracking-widest ml-1">
                Message <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="4"
                placeholder="What's on your mind?"
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
                "Sending..."
              ) : (
                <>
                  Send Message{" "}
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

      {/* FAQ Section */}
      <div className="mt-24 hidden">
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-12 text-center">
          Frequently Asked Questions
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
