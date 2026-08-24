import { useCallback, useState } from "react";
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
 * so the tab grid and the Today panel share one implementation of the toggle,
 * the pending state and the AppContext write-back.
 *
 * Reads are synchronous and network-free — the ids are already on the loaded
 * profile, so nothing here fetches. Only the toggle talks to the backend, and
 * it goes through the same `/api/firestore` PUT every other favourite kind
 * uses; there is no feature-specific endpoint.
 *
 * The list is NOT filtered for tier visibility here. Callers rendering stored
 * ids must run them through `useTierAccess().isVisible` themselves, because a
 * feature can be hidden or revoked long after it was favourited.
 *
 * @returns {{
 *   favouriteIds: string[],
 *   isFavourite: (featureId: string) => boolean,
 *   isPending: (featureId: string) => boolean,
 *   toggle: (featureId: string) => Promise<void>,
 * }}
 */
export function useFeatureFavourites() {
  const { user, setUser, showAlert } = useAppContext();
  const { t } = useTranslation();
  const [pendingIds, setPendingIds] = useState([]);

  const favouriteIds = getFavouriteIds(user, FAVOURITE_KINDS.FEATURE);

  const isFavourite = useCallback(
    (featureId) => favouriteIds.includes(featureId),
    [favouriteIds],
  );

  const isPending = useCallback(
    (featureId) => pendingIds.includes(featureId),
    [pendingIds],
  );

  const toggle = useCallback(
    async (featureId) => {
      if (!user?.token || !user?.uid || !featureId) return;

      const currentIds = getFavouriteIds(user, FAVOURITE_KINDS.FEATURE);
      setPendingIds((prev) => [...prev, featureId]);

      try {
        const { ids } = await toggleFavourite({
          token: user.token,
          uid: user.uid,
          kind: FAVOURITE_KINDS.FEATURE,
          id: featureId,
          currentIds,
        });
        // Write the same field the service wrote, so the heart survives
        // navigation without another profile read.
        setUser((prev) =>
          prev ? { ...prev, [favouriteFieldFor(FAVOURITE_KINDS.FEATURE)]: ids } : prev,
        );
      } catch (err) {
        showAlert("error", err.message || t("settings.errors.save_failed"));
      } finally {
        setPendingIds((prev) => prev.filter((id) => id !== featureId));
      }
    },
    [user, setUser, showAlert, t],
  );

  return { favouriteIds, isFavourite, isPending, toggle };
}
