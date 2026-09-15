import { useCallback, useState } from "react";
import { DEFAULT_TONE, TONE_STORAGE_KEY, TONES } from "../config/professionalTools";

/**
 * useToneChoice
 *
 * The formal/informal preference shared by all three professional tools.
 *
 * Kept in localStorage, not Firestore. It is a UI preference rather than user
 * data: it needs no admin config, no migration, and above all no round trip on
 * a page somebody opened to write an urgent email. One shared value across the
 * three tools is the right default — picking "informal" on the email writer
 * and finding the tone rewriter already informal is what a person expects.
 *
 * If it ever needs to follow a user between devices it becomes one field on
 * `users/{uid}` via updateUserProfile — one field, no new mechanism.
 *
 * Every access is wrapped: Safari in private mode throws on localStorage
 * rather than returning null, and a tool that cannot open because of a storage
 * preference would be a poor trade.
 */
export function useToneChoice() {
  const [tone, setToneState] = useState(() => {
    try {
      const saved = localStorage.getItem(TONE_STORAGE_KEY);
      return Object.values(TONES).includes(saved) ? saved : DEFAULT_TONE;
    } catch {
      return DEFAULT_TONE;
    }
  });

  const setTone = useCallback((next) => {
    setToneState(next);
    try {
      localStorage.setItem(TONE_STORAGE_KEY, next);
    } catch {
      // Preference lost on reload; the tool still works this session.
    }
  }, []);

  return { tone, setTone };
}
