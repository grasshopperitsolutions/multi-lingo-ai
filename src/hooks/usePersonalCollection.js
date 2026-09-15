import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import {
  addPersonalItem,
  listPersonalItems,
  removePersonalItem,
  updatePersonalItem,
} from "../services/personalService";

/**
 * usePersonalCollection
 *
 * One kind of personal item — notes, phrases, mistakes, questions — loaded
 * once and edited optimistically.
 *
 * Optimistic for the same reason useWordFavourites is: waiting on a round trip
 * to make a list row appear feels broken, especially on a phone on a bad
 * connection right after a lesson. Every write rolls the list back and
 * surfaces the error if it fails, so the screen never quietly disagrees with
 * what was stored.
 *
 * @param {string} kind - one of PERSONAL_KINDS
 */
export function usePersonalCollection(kind) {
  const { user, showAlert } = useAppContext();
  const { t } = useTranslation();

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [atLimit, setAtLimit] = useState(false);

  const token = user?.token;
  const uid = user?.uid;

  useEffect(() => {
    if (!token || !uid) return;
    let cancelled = false;

    setIsLoading(true);
    listPersonalItems({ token, uid, kind })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setAtLimit(result.atLimit);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [token, uid, kind]);

  const add = useCallback(
    async (data) => {
      if (!token || !uid) return;

      // A temporary id so the row can render before the server answers; it is
      // replaced by the real one, and removed entirely if the write fails.
      const tempId = `pending-${Date.now()}`;
      const optimistic = { id: tempId, ...data, createdAt: new Date().toISOString() };
      setItems((prev) => [optimistic, ...prev]);

      try {
        const created = await addPersonalItem({ token, uid, kind, data });
        setItems((prev) =>
          prev.map((item) => (item.id === tempId ? { ...optimistic, id: created.id } : item)),
        );
      } catch (err) {
        setItems((prev) => prev.filter((item) => item.id !== tempId));
        showAlert("error", err.message || t("settings.errors.save_failed"));
      }
    },
    [token, uid, kind, showAlert, t],
  );

  const update = useCallback(
    async (id, data) => {
      if (!token || !uid) return;

      const previous = items;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));

      try {
        await updatePersonalItem({ token, uid, kind, id, data });
      } catch (err) {
        setItems(previous);
        showAlert("error", err.message || t("settings.errors.save_failed"));
      }
    },
    [token, uid, kind, items, showAlert, t],
  );

  const remove = useCallback(
    async (id) => {
      if (!token || !uid) return;

      const previous = items;
      setItems((prev) => prev.filter((item) => item.id !== id));

      try {
        await removePersonalItem({ token, uid, kind, id });
      } catch (err) {
        setItems(previous);
        showAlert("error", err.message || t("settings.errors.save_failed"));
      }
    },
    [token, uid, kind, items, showAlert, t],
  );

  return { items, isLoading, error, atLimit, add, update, remove };
}
