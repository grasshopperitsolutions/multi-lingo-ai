import { useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown } from "lucide-react";

const FaqItem = ({ question, answer, isDarkMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`border-4 rounded-2xl overflow-hidden transition-all duration-300 ${
        isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-900 bg-white"
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex justify-between items-center text-left focus:outline-none hover:bg-opacity-50"
      >
        <h4 className="font-black text-xl uppercase tracking-tight pr-4">
          {question}
        </h4>
        <ChevronDown
          className={`flex-shrink-0 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={24}
        />
      </button>
      <div
        className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-48 pb-6 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p className="font-bold opacity-80 text-lg">{answer}</p>
      </div>
    </div>
  );
};

FaqItem.propTypes = {
  question: PropTypes.string.isRequired,
  answer: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default FaqItem;
