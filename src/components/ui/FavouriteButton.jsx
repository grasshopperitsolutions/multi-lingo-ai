import PropTypes from 'prop-types';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * FavouriteButton.jsx
 *
 * The heart toggle used wherever something can be favourited (grammar tips,
 * stories, words, whole features — see favouritesService.FAVOURITE_KINDS).
 * Filled when on, outline when off.
 *
 * Borderless: it sits beside ReportButton's flag in feature page headers, and
 * the two read as a pair only if neither carries a frame. State is shown by
 * the fill and the colour instead.
 *
 * Presentational and fully controlled: the caller owns `isFavourite` and does
 * the persisting in `onToggle`. That keeps the optimistic-update decision with
 * the feature rather than baking one policy in here.
 *
 * Usage:
 *   <FavouriteButton
 *     isFavourite={fav}
 *     onToggle={handleToggleFavourite}
 *     isDarkMode={isDarkMode}
 *   />
 */
const FavouriteButton = ({ isFavourite, onToggle, isDarkMode, disabled = false, size = 16 }) => {
  const { t } = useTranslation();

  const label = isFavourite
    ? t('favourites.remove', 'Remove from favourites')
    : t('favourites.add', 'Add to favourites');

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={isFavourite}
      className={`shrink-0 inline-flex items-center p-1.5 rounded-lg transition-colors active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
        isFavourite
          ? isDarkMode
            ? 'text-rose-400 hover:text-rose-300'
            : 'text-rose-500 hover:text-rose-600'
          : isDarkMode
            ? 'text-slate-500 hover:text-rose-400'
            : 'text-slate-400 hover:text-rose-500'
      }`}
    >
      <Heart size={size} fill={isFavourite ? 'currentColor' : 'none'} />
    </button>
  );
};

FavouriteButton.propTypes = {
  isFavourite: PropTypes.bool.isRequired,
  onToggle:    PropTypes.func.isRequired,
  isDarkMode:  PropTypes.bool.isRequired,
  disabled:    PropTypes.bool,
  size:        PropTypes.number,
};

FavouriteButton.defaultProps = {
  disabled: false,
  size: 16,
};

export default FavouriteButton;
