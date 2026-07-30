import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../../contexts/AppContext";
import DictionaryPanel from "../../components/DictionaryPanel";

const DictionaryPage = () => {
  const { isDarkMode } = useAppContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  // Clear the ?q= param once DictionaryPanel has consumed it, so a later
  // back-navigation into this page doesn't replay the same lookup.
  useEffect(() => {
    if (initialQuery) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DictionaryPanel
      isDarkMode={isDarkMode}
      onBack={() => navigate("/dashboard")}
      initialQuery={initialQuery}
    />
  );
};

export default DictionaryPage;
