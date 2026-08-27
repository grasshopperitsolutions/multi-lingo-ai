import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  SHELF,
  SHELF_MOBILE,
  BOOK_TIMING,
  BOOK_HOVER,
  shelfAngle,
} from "../../config/dashboardBooks";
import { usePageTurnSound } from "../../hooks/usePageTurnSound";
import Book from "./Book";
import BookSpread from "./BookSpread";

/** Shelf → pulled out → opened. Closing returns straight to shelf. */
const PHASE = {
  SHELF: "shelf",
  OPENING: "opening",
  OPEN: "open",
};

/** How long the pull-out-and-turn takes, measured from the click. */
const openDuration = (BOOK_TIMING.OPEN_DELAY + BOOK_TIMING.OPEN) * 1000;

/**
 * BookShelf
 *
 * The floating-book presentation of the dashboard groups, spines toward the
 * reader.
 *
 * The books stand on an arc centred on the viewer. In CSS that is
 * `rotateY(angle) translateZ(-radius)` — but framer-motion always composes
 * translate before rotate, so the same placement is expressed here as an
 * explicit point on the circle (x = -R·sin θ, z = -R·cos θ) plus a rotation of
 * θ. The two are equivalent; only the second can be animated per-property.
 *
 * Picking a book pulls it out of the row and turns it a quarter turn so the
 * cover comes round to face the reader, then hands over to BookSpread — see
 * that file for why the opened content deliberately stops being 3D.
 */
const BookShelf = ({ groups, isDarkMode, isNarrow, prefersReducedMotion }) => {
  const { t } = useTranslation();
  const { playCover, playPage } = usePageTurnSound();
  const [phase, setPhase] = useState(PHASE.SHELF);
  const [selectedId, setSelectedId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const timerRef = useRef(null);
  // Mirrors selectedId for the animation callback, which must stay referentially
  // stable or every book re-registers its handler on each render.
  const selectedIdRef = useRef(null);
  const sceneRef = useRef(null);
  const spreadRef = useRef(null);

  const geometry = isNarrow ? SHELF_MOBILE : SHELF;
  const selected = groups.find((group) => group.id === selectedId) ?? null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Reduced motion keeps the book metaphor but skips the journey: the spread
  // appears directly rather than being pulled out and turned.
  const flightMs = prefersReducedMotion ? 0 : openDuration;

  const handleSelect = useCallback(
    (groupId) => {
      if (phase !== PHASE.SHELF) return;
      setHovered(null);
      setSelectedId(groupId);
      setPhase(PHASE.OPENING);
      playCover();
      // The book's own animation tells us when it has finished being pulled out
      // (see onAnimationComplete below). This timer is only a backstop: if the
      // tab is hidden mid-flight the animation never completes and, without it,
      // the shelf would be stuck in OPENING forever.
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPhase(PHASE.OPEN), flightMs);
    },
    [phase, playCover, flightMs],
  );

  /** Promote OPENING → OPEN as soon as the selected book has settled. */
  const handleBookSettled = useCallback((groupId) => {
    setPhase((current) =>
      current === PHASE.OPENING && groupId === selectedIdRef.current ? PHASE.OPEN : current,
    );
  }, []);

  const handleClose = useCallback(() => {
    // Straight back to the shelf rather than through a timed CLOSING phase.
    // The books animate home from wherever they happen to be, so there is no
    // window in which a throttled timer can strand them mid-flight.
    clearTimeout(timerRef.current);
    setPhase(PHASE.SHELF);
    setSelectedId(null);
    playCover();
  }, [playCover]);

  /** Park the tooltip over the book being pointed at (or focused). */
  const showTooltip = useCallback((group, element) => {
    const scene = sceneRef.current;
    if (!scene || !element) return;
    const sceneRect = scene.getBoundingClientRect();
    const bookRect = element.getBoundingClientRect();
    setHovered({
      id: group.id,
      label: group.label,
      x: bookRect.x + bookRect.width / 2 - sceneRect.x,
      y: bookRect.y - sceneRect.y,
    });
  }, []);

  // Move focus into the opened book, and back out when it closes, so the
  // keyboard does not get stranded on a button that no longer exists.
  useEffect(() => {
    if (phase === PHASE.OPEN) spreadRef.current?.focus();
  }, [phase]);

  const sceneHeight = isNarrow ? 300 : 430;

  return (
    <div className="w-full">
      {/* Deliberately a plain conditional rather than AnimatePresence.
          Wrapping this swap in <AnimatePresence mode="wait"> deadlocked: the
          shelf is a subtree of absolutely-positioned, 3D-transformed children,
          its exit never reported complete, and the spread was therefore never
          mounted — clicking a book did nothing at all. The swap only ever
          needed an entry fade, which each branch does for itself. */}
      <>
        {phase === PHASE.OPEN ? (
          <motion.div
            key="spread"
            ref={spreadRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            className="outline-none"
          >
            <BookSpread
              groupId={selected.id}
              title={selected.label}
              description={selected.description}
              icon={selected.icon}
              tiles={selected.tiles}
              isDarkMode={isDarkMode}
              isNarrow={isNarrow}
              onClose={handleClose}
              onPageTurn={playPage}
            />
          </motion.div>
        ) : (
          <motion.div
            key="shelf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            <div
              ref={sceneRef}
              className={`relative w-full ${isNarrow ? "book-scene book-scene-mobile" : "book-scene"}`}
              style={{ height: sceneHeight }}
              onMouseLeave={() => setHovered(null)}
            >
              {/* pointer-events-none is load-bearing, not tidying.
                  This wrapper's own box sits at z = 0 while every book is
                  pushed ~RADIUS px behind it, so in a preserve-3d context the
                  wrapper wins the hit test across the whole shelf and swallows
                  every click — the books were visible but completely
                  unclickable. The books opt back in individually. */}
              <div
                className="absolute inset-0 preserve-3d pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              >
                {groups.map((group, index) => {
                  const angle = shelfAngle(index, groups.length, geometry.STEP);
                  const radians = (angle * Math.PI) / 180;
                  const isSelected = group.id === selectedId;
                  const isLeaving = phase !== PHASE.SHELF && !isSelected;

                  // The arc position, as a point on the circle plus a turn.
                  const shelfTarget = {
                    x: -geometry.RADIUS * Math.sin(radians),
                    z: -geometry.RADIUS * Math.cos(radians),
                    rotateY: angle,
                    scale: 1,
                    opacity: 1,
                    y: 0,
                  };

                  // Pulled out of the row and turned a quarter turn, bringing
                  // the front board round to face the reader.
                  const focusedTarget = {
                    x: 0,
                    y: 0,
                    z: 60,
                    rotateY: -90,
                    scale: 1.05,
                    opacity: 1,
                  };

                  const leavingTarget = {
                    x: -geometry.RADIUS * 1.5 * Math.sin(radians),
                    y: 0,
                    z: -geometry.RADIUS * 1.6,
                    rotateY: angle,
                    scale: 0.85,
                    opacity: 0,
                  };

                  let target = shelfTarget;
                  if (isSelected && phase !== PHASE.SHELF) target = focusedTarget;
                  else if (isLeaving) target = leavingTarget;

                  const onShelf = target === shelfTarget;

                  return (
                    <Book
                      key={group.id}
                      groupId={group.id}
                      title={group.label}
                      icon={group.icon}
                      spineWidth={geometry.SPINE_WIDTH}
                      height={geometry.HEIGHT}
                      coverDepth={geometry.COVER_DEPTH}
                      isDarkMode={isDarkMode}
                      isOpening={isSelected && phase === PHASE.OPENING}
                      onSelect={() => handleSelect(group.id)}
                      timing={BOOK_TIMING}
                      animate={target}
                      initial={false}
                      onAnimationComplete={() => handleBookSettled(group.id)}
                      // Leans out toward the reader — the "about to pick this
                      // one" cue. Only offered while the book is on the shelf.
                      whileHover={
                        onShelf && !prefersReducedMotion
                          ? {
                              z: shelfTarget.z + BOOK_HOVER.Z,
                              y: BOOK_HOVER.LIFT,
                              rotateY: angle + BOOK_HOVER.TURN,
                              scale: 1.04,
                            }
                          : undefined
                      }
                      whileFocus={
                        onShelf
                          ? { z: shelfTarget.z + BOOK_HOVER.Z, y: BOOK_HOVER.LIFT, scale: 1.04 }
                          : undefined
                      }
                      onHoverStart={(event) =>
                        onShelf && showTooltip(group, event.currentTarget)
                      }
                      onFocus={(event) => onShelf && showTooltip(group, event.currentTarget)}
                      onBlur={() => setHovered(null)}
                      transition={{
                        duration: prefersReducedMotion ? 0 : BOOK_TIMING.FLY,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      style={{ zIndex: isSelected ? 10 : 1 }}
                    />
                  );
                })}
              </div>

              {/* Title tooltip. Lives outside the 3D subtree on purpose: inside
                  it, a bubble would be projected and sheared along with the
                  book it belongs to. */}
              <AnimatePresence>
                {hovered && (
                  <motion.div
                    key={hovered.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    role="tooltip"
                    className={`pointer-events-none absolute z-20 px-3 py-2 rounded-xl border-4 whitespace-nowrap text-xs font-black uppercase tracking-widest ${
                      isDarkMode
                        ? "bg-slate-900 border-slate-600 text-slate-100 shadow-[4px_4px_0px_0px_#475569]"
                        : "bg-slate-900 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
                    }`}
                    style={{
                      left: hovered.x,
                      top: Math.max(0, hovered.y - 46),
                      transform: "translateX(-50%)",
                    }}
                  >
                    {hovered.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p
              className={`text-center text-xs font-black uppercase tracking-widest ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {t("dashboard.books.shelf_hint")}
            </p>
          </motion.div>
        )}
      </>
    </div>
  );
};

BookShelf.propTypes = {
  /** Groups with resolved label, description, icon and tiles. */
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      description: PropTypes.string,
      icon: PropTypes.elementType.isRequired,
      tiles: PropTypes.array.isRequired,
    }),
  ).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isNarrow: PropTypes.bool,
  prefersReducedMotion: PropTypes.bool,
};

BookShelf.defaultProps = {
  isNarrow: false,
  prefersReducedMotion: false,
};

export default BookShelf;
