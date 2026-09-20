import { useEffect } from "react";

/**
 * useScrollToHash
 *
 * Scrolls to the element a URL hash names, once it exists.
 *
 * The browser's own hash handling cannot do this in a client-rendered app: it
 * runs on navigation, before React has rendered anything, finds no element and
 * gives up silently. So Settings' `#practiceLanguage`, `#tutorSettings`,
 * `#personalWidgets` and `#reminderSettings` opened the right card and then
 * left you wherever you happened to be on a nine-card page — which reads
 * exactly like the link not having worked.
 *
 * **It retries, because the target can render late.** `TutorProfileSection`
 * shows nothing until it has fetched the profile, and that is the link most
 * often followed from another page. One attempt on mount would scroll to
 * nothing precisely there.
 *
 * Gives up quietly after roughly a second. A card that never appears is a tier
 * the viewer does not have, not an error worth surfacing.
 *
 * The retry is a `setTimeout` loop rather than `requestAnimationFrame` for a
 * reason worth keeping: a hidden or backgrounded tab produces no frames, so an
 * rAF loop never runs there at all — and opening this link in a tab that is
 * not focused yet is an ordinary way to arrive, not an edge case.
 */

/** Long enough for a profile fetch, short enough not to hijack a later scroll. */
const MAX_ATTEMPTS = 20;
const RETRY_MS = 50;

/** Flush against the viewport edge reads as clipped. */
const TOP_GAP_PX = 16;

/**
 * @param {string} hash - e.g. "#practiceLanguage". Empty or absent does nothing.
 */
export function useScrollToHash(hash) {
  useEffect(() => {
    const id = typeof hash === "string" ? hash.replace(/^#/, "") : "";
    if (!id || typeof window === "undefined") return undefined;

    let timer = 0;
    let attempts = 0;

    const tryScroll = () => {
      const target = document.getElementById(id);
      if (!target) {
        // setTimeout, not requestAnimationFrame. A hidden or backgrounded tab
        // produces no frames at all, so an rAF loop simply never runs — and
        // "opened from a link in a tab that wasn't focused yet" is an ordinary
        // way to arrive here, not an edge case.
        if (attempts++ < MAX_ATTEMPTS) timer = setTimeout(tryScroll, RETRY_MS);
        return;
      }

      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Not scrollIntoView: it takes no offset, so the card would sit flush
      // against the top of the viewport.
      const top = target.getBoundingClientRect().top + window.scrollY - TOP_GAP_PX;
      window.scrollTo({ top: Math.max(top, 0), behavior: reduced ? "auto" : "smooth" });
    };

    tryScroll();
    return () => clearTimeout(timer);
  }, [hash]);
}
