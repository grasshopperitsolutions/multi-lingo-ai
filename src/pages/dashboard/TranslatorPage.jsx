import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/AppContext";
import TranslatorPanel from "../../components/TranslatorPanel";

const TranslatorPage = () => {
  const { isDarkMode } = useAppContext();
  const navigate = useNavigate();

  return (
    <TranslatorPanel
      isDarkMode={isDarkMode}
      onBack={() => navigate("/dashboard")}
      onLookupInDictionary={(phrase) =>
        navigate(`/dashboard/dictionary?q=${encodeURIComponent(phrase)}`)
      }
    />
  );
};

export default TranslatorPage;
