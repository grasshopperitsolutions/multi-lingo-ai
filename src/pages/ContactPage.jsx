import React from "react";
import { useAppContext } from "../contexts/AppContext";

const ContactPage = () => {
  const { isDarkMode, t } = useAppContext();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
      
      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <p className="leading-relaxed opacity-90 mb-8">
            We'd love to hear from you. Whether you have a question about features,
            pricing, need a demo, or anything else, our team is ready to answer all your questions.
          </p>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                📧
              </div>
              <div>
                <h3 className="font-bold text-lg">Email</h3>
                <p className="opacity-80">contact@nunolingo.com</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                📍
              </div>
              <div>
                <h3 className="font-bold text-lg">Location</h3>
                <p className="opacity-80">Lisbon, Portugal</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                ⏰
              </div>
              <div>
                <h3 className="font-bold text-lg">Business Hours</h3>
                <p className="opacity-80">Monday - Friday, 9am - 6pm WEST</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`p-8 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-white shadow-xl'}`}>
          <form className="space-y-6">
            <div>
              <label className="block font-medium mb-2">Your Name</label>
              <input 
                type="text" 
                className={`w-full px-4 py-3 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'border-slate-300'}`}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">Email Address</label>
              <input 
                type="email" 
                className={`w-full px-4 py-3 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'border-slate-300'}`}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block font-medium mb-2">Message</label>
              <textarea 
                rows={5}
                className={`w-full px-4 py-3 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'border-slate-300'}`}
                placeholder="How can we help you?"
              ></textarea>
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;