import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useAlbumStickers } from "../../hooks/useAlbumStickers";
import { useInterestTopics } from "../../hooks/useInterestTopics";
import { useTts } from "../../hooks/useTts";
import { getPicturePool } from "../../services/getImageService";
import { getConceptTranslations } from "../../services/getWordService";
import { groupByTopic } from "../../utils/pictureRound";
import { TtsControls } from "../ui";
import Loader from "../Loader";
import PictureTile from "./PictureTile";

/** The page for words that carry no topic. Not a topic id, so it can never collide with one. */
const OTHER_PAGE = "__other";

/**
 * A Caderneta (picture_album)
 *
 * A sticker album. Every word answered right in a picture game sticks its
 * picture here: one page per topic, a "?" where a sticker has not been earned,
 * and a count on every page ("12 / 40").
 *
 * - **A page's total is the words in that topic that have a picture**, so it
 *   grows as the pool does, and a sticker earned for a word that has since lost
 *   its picture never counts for more than the album can show.
 * - **A word on several topics is on several pages**, and counts on each.
 * - **Reads only.** Nothing here asks an AI for anything: the album is the
 *   pool's pictures joined with a list of ids. Tapping a sticker reads that one
 *   word's translation, and the speaker is the usual one.
 * - **The saved list is per practice language**, so a new language starts with
 *   an empty album.
 */
const PictureAlbum = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, categories } = useAppContext();
  const { topics: interests } = useInterestTopics();
  const { stickers, isLoaded } = useAlbumStickers();
  const { ttsState, playTts, pauseTts, stopTts } = useTts();

  const token = user?.token;
  const dialect = user?.learningDialect ?? "pt-PT";

  const [pictured, setPictured] = useState(null);
  const [error, setError] = useState(null);
  const [activePage, setActivePage] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    getPicturePool(token)
      .then(({ pictured: found }) => !cancelled && setPictured(found))
      .catch((err) => !cancelled && setError(err?.message ?? ""));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Tapping a sticker reads its word, once, and only that one.
  useEffect(() => {
    if (!selected || !token) {
      setSelectedWord(null);
      return undefined;
    }
    let cancelled = false;
    getConceptTranslations([selected], dialect, token).then((found) => {
      if (!cancelled) setSelectedWord(found.get(selected)?.word ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, token, dialect]);

  const labelOf = useMemo(() => {
    const byId = new Map((Array.isArray(categories) ? categories : []).map((c) => [c.id, c.label]));
    return (id) => t(`categories.${id}`, { defaultValue: byId.get(id) || id });
  }, [categories, t]);

  const pages = useMemo(() => {
    if (!pictured) return [];
    const interestIds = new Set(interests.map((topic) => topic.id));
    const byTopic = [...groupByTopic(pictured).entries()]
      .map(([id, concepts]) => ({ id, label: labelOf(id), concepts }))
      // The player's own interests first, then by name. Sorted in code.
      .sort(
        (a, b) =>
          (interestIds.has(a.id) ? 0 : 1) - (interestIds.has(b.id) ? 0 : 1) || a.label.localeCompare(b.label),
      );

    const untagged = pictured.filter((concept) => !(concept.topicIds ?? []).length);
    if (untagged.length > 0) byTopic.push({ id: OTHER_PAGE, label: t("picture_games.album.other"), concepts: untagged });

    return byTopic.map((page) => ({
      ...page,
      concepts: [...page.concepts].sort((a, b) => a.sourceWord.localeCompare(b.sourceWord) || a.id.localeCompare(b.id)),
    }));
  }, [pictured, interests, labelOf, t]);

  if (error) {
    return <p className="text-rose-500 font-semibold text-center py-10 px-4">{t("picture_games.error")}</p>;
  }
  if (!pictured || !isLoaded) {
    return <Loader isDarkMode={isDarkMode} message={t("picture_games.loading")} />;
  }

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  if (pictured.length === 0) {
    return <p className={`text-center font-semibold py-10 px-4 ${muted}`}>{t("picture_games.album.empty")}</p>;
  }

  const countOf = (concepts) => concepts.filter((concept) => stickers.has(concept.id)).length;
  const page = pages.find((p) => p.id === activePage) ?? pages[0];
  const collectedAll = countOf(pictured);

  const handleSelect = (conceptId) => {
    stopTts();
    setSelected((current) => (current === conceptId ? null : conceptId));
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-3xl mx-auto animate-in fade-in">
      <p className={`text-xs font-black uppercase tracking-widest ${muted}`}>
        {t("picture_games.album.total", { collected: collectedAll, total: pictured.length })}
      </p>

      {/* Topic pages. Scrolls sideways on a phone, where there are more
          topics than width, instead of wrapping into a wall of chips. */}
      <div
        role="tablist"
        aria-label={t("picture_games.album.pages")}
        className="flex gap-2 overflow-x-auto scrollbar-hidden pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap"
      >
        {pages.map((entry) => {
          const isActive = entry.id === page.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActivePage(entry.id);
                setSelected(null);
                stopTts();
              }}
              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                isActive
                  ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                  : isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-white border-slate-300 text-slate-600"
              }`}
            >
              {entry.label} · {countOf(entry.concepts)}/{entry.concepts.length}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className={`rounded-2xl border-4 p-4 sm:p-6 ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {page.label}
          </h2>
          <span className={`text-xl font-black tabular-nums ${isDarkMode ? "text-yellow-400" : "text-slate-900"}`}>
            {t("picture_games.album.count", { collected: countOf(page.concepts), total: page.concepts.length })}
          </span>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {page.concepts.map((concept) =>
            stickers.has(concept.id) ? (
              <PictureTile
                key={concept.id}
                url={concept.url}
                conceptId={concept.id}
                isDarkMode={isDarkMode}
                state={selected === concept.id ? "correct" : "idle"}
                onClick={() => handleSelect(concept.id)}
                ariaLabel={t("picture_games.album.sticker")}
              />
            ) : (
              <div
                key={concept.id}
                role="img"
                aria-label={t("picture_games.album.empty_slot")}
                className={`flex aspect-square items-center justify-center rounded-2xl border-4 border-dashed text-3xl font-black ${
                  isDarkMode ? "border-slate-600 text-slate-600" : "border-slate-300 text-slate-300"
                }`}
              >
                ?
              </div>
            ),
          )}
        </div>

        {selected && (
          <div
            className={`mt-5 flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 animate-in fade-in ${
              isDarkMode ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-slate-50"
            }`}
          >
            <span lang={dialect} className={`text-xl font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {selectedWord ?? "…"}
            </span>
            <span className="flex items-center gap-2">
              {selectedWord && (
                <TtsControls
                  ttsKey={`picture-album-${selected}`}
                  text={selectedWord}
                  lang={dialect}
                  token={token}
                  accent="amber"
                  variant="single"
                  ttsState={ttsState}
                  playTts={playTts}
                  pauseTts={pauseTts}
                  stopTts={stopTts}
                  isDarkMode={isDarkMode}
                />
              )}
              <button
                type="button"
                onClick={() => handleSelect(selected)}
                aria-label={t("picture_games.album.close")}
                className={`p-2 rounded-lg ${muted} hover:opacity-70`}
              >
                <X size={18} />
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

PictureAlbum.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureAlbum;
