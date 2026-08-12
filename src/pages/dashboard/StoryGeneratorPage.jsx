import { useAppContext } from "../../contexts/AppContext";
import StoryReader from "../../components/StoryReader";

const StoryGeneratorPage = () => {
  const { isDarkMode } = useAppContext();

  return <StoryReader isDarkMode={isDarkMode} />;
};

export default StoryGeneratorPage;
