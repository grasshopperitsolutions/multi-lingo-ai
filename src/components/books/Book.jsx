import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { bookSkinFor } from "../../config/dashboardBooks";

/**
 * Book
 *
 * One book standing on the shelf, spine toward the reader.
 *
 * Geometry
 * --------
 * The button's own box *is* the spine. That matters for more than looks: when
 * the clickable element matches the flat rectangle the reader can see, the hit
 * target and the visual can never drift apart. The previous cover-forward
 * version made the button cover-sized and then showed a 3D-projected face at a
 * different place on screen, so clicks landed on nothing.
 *
 * Two cover boards hinge off the spine's left and right edges and recede into
 * the shelf, boxing the book out. Both use the same quarter turn: rotateY(90deg)
 * maps their local +X onto -Z, i.e. straight back. Books toward the ends of the
 * arc turn enough to show one of them, which is what stops the row reading as a
 * line of flat cards.
 *
 * The title is deliberately not drawn here — it is a tooltip, owned by the
 * shelf, so a long group name cannot be clipped by a narrow spine.
 */
const Book = ({
  groupId,
  title,
  icon: Icon,
  spineWidth,
  height,
  coverDepth,
  isDarkMode,
  isOpening,
  onSelect,
  timing,
  style,
  ...motionProps
}) => {
  const skin = bookSkinFor(groupId);
  const iconSize = Math.max(18, Math.round(spineWidth * 0.42));

  /** A cover board receding from one edge of the spine. */
  const board = (leftOffset) => (
    <div
      className={`absolute top-0 border-4 border-slate-900 ${skin.spine}`}
      style={{
        left: leftOffset,
        width: coverDepth,
        height,
        transformOrigin: "left center",
        transform: "rotateY(90deg)",
      }}
    />
  );

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-label={title}
      // pointer-events-auto opts back in: the shelf wrapper disables pointer
      // events for the whole scene so its own z = 0 box cannot intercept clicks
      // meant for books sitting further back. See BookShelf.
      className="absolute preserve-3d cursor-pointer pointer-events-auto"
      {...motionProps}
      // Merged rather than spread over: the caller passes z-index, and letting
      // a caller `style` replace this object wholesale would drop the book's
      // own size and centring.
      style={{
        width: spineWidth,
        height,
        transformStyle: "preserve-3d",
        left: "50%",
        top: "50%",
        marginLeft: -spineWidth / 2,
        marginTop: -height / 2,
        ...style,
      }}
    >
      {/* Both boards in one flat colour. This used to be a back board dimmed
          with brightness-75 plus a striped "page edge" block between them,
          which read as a white page of text rather than as a book. */}
      {board(0)}
      {board(spineWidth)}

      {/* The spine itself — the face, and the whole hit target. */}
      <motion.div
        className={`absolute inset-0 rounded-sm border-4 border-slate-900 flex flex-col items-center justify-between py-4 ${skin.cover}`}
        style={{ boxShadow: `4px 4px 0px 0px ${skin.edge}` }}
        initial={false}
        animate={{ opacity: isOpening ? 0.85 : 1 }}
        transition={{ duration: timing.OPEN * 0.5 }}
      >
        {/* Head band */}
        <span
          className="w-full border-b-4 border-slate-900"
          style={{ height: 6, backgroundColor: skin.edge }}
        />

        <span
          className={`flex items-center justify-center rounded-lg border-4 border-slate-900 ${
            isDarkMode ? "bg-slate-900/15" : "bg-white/45"
          }`}
          style={{ width: iconSize + 16, height: iconSize + 16 }}
        >
          <Icon size={iconSize} className={skin.ink} />
        </span>

        {/* Tail band */}
        <span
          className="w-full border-t-4 border-slate-900"
          style={{ height: 6, backgroundColor: skin.edge }}
        />
      </motion.div>
    </motion.button>
  );
};

Book.propTypes = {
  groupId: PropTypes.string.isRequired,
  /** Accessible name. Shown visually as a tooltip by the shelf, not on the spine. */
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  spineWidth: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  coverDepth: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isOpening: PropTypes.bool,
  onSelect: PropTypes.func,
  timing: PropTypes.shape({
    OPEN: PropTypes.number.isRequired,
  }).isRequired,
  /** Merged into the book's own positioning styles, not substituted for them. */
  style: PropTypes.object,
};

Book.defaultProps = {
  isOpening: false,
  onSelect: undefined,
  style: undefined,
};

export default Book;
