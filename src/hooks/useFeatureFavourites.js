import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import {
  FAVOURITE_KINDS,
  getFavouriteIds,
  toggleFavourite,
  favouriteFieldFor,
} from "../services/favouritesService";

/**
 * useFeatureFavourites
 *
 * The heart on a dashboard tile. Wraps favouritesService for the FEATURE kind
 * so every surface shares one implementation of the toggle and the AppContext
 * write-back.
 *
 * Reads are synchronous and network-free — the ids are already on the loaded
 * profile, so nothing here fetches. Only the toggle talks to the backend, and
 * it goes through the same `/api/firestore` PUT every other favourite kind
 * uses; there is no feature-specific endpoint.
 *
 * The toggle is **optimistic**: it updates the profile in context immediately
 * and lets the write finish behind it, because waiting on a round trip to make
 * a heart fill in feels broken. A failed write puts the previous list back and
 * surfaces the error, so the UI never silently disagrees with what was stored.
 *
 * The list is NOT filtered for tier visibility here. Callers rendering stored
 * ids must run them through `useTierAccess().isVisible` themselves, because a
 * feature can be hidden or revoked long after it was favourited.
 *
 * @returns {{
 *   favouriteIds: string[],
 *   isFavourite: (featureId: string) => boolean,
 *   toggle: (featureId: string) => void,
 * }}
 */
export function useFeatureFavourites() {
  const { user, setUser, showAlert } = useAppContext();
  const { t } = useTranslation();

  const favouriteIds = getFavouriteIds(user, FAVOURITE_KINDS.FEATURE);

  const isFavourite = useCallback(
    (featureId) => favouriteIds.includes(featureId),
    [favouriteIds],
  );

  const toggle = useCallback(
    (featureId) => {
      if (!user?.token || !user?.uid || !featureId) return;

      const field = favouriteFieldFor(FAVOURITE_KINDS.FEATURE);
      const currentIds = getFavouriteIds(user, FAVOURITE_KINDS.FEATURE);
      const nextIds = currentIds.includes(featureId)
        ? currentIds.filter((id) => id !== featureId)
        : [...currentIds, featureId];

      // Move the UI first. The same field the service writes is updated here,
      // so the change survives navigation without another profile read.
      setUser((prev) => (prev ? { ...prev, [field]: nextIds } : prev));

      toggleFavourite({
        token: user.token,
        uid: user.uid,
        kind: FAVOURITE_KINDS.FEATURE,
        id: featureId,
        currentIds,
      }).catch((err) => {
        // Roll back rather than leave the list showing something that was
        // never stored — on the next load it would reappear anyway.
        setUser((prev) => (prev ? { ...prev, [field]: currentIds } : prev));
        showAlert("error", err.message || t("settings.errors.save_failed"));
      });
    },
    [user, setUser, showAlert, t],
  );

  return { favouriteIds, isFavourite, toggle };
}
