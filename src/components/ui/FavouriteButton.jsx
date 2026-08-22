import PropTypes from 'prop-types';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * FavouriteButton.jsx
 *
 * The heart toggle used wherever something can be favourited (grammar tips,
 * stories, words — see favouritesService.FAVOURITE_KINDS). Filled when on,
 * outline when off.
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
      className={`shrink-0 p-2 rounded-lg border-2 transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
        isFavourite
          ? isDarkMode
            ? 'border-rose-500/60 text-rose-400 hover:bg-rose-500/10'
            : 'border-rose-400 text-rose-500 hover:bg-rose-50'
          : isDarkMode
            ? 'border-slate-600 text-slate-500 hover:text-rose-400 hover:border-rose-500/60'
            : 'border-slate-300 text-slate-400 hover:text-rose-500 hover:border-rose-400'
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
