import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  loginWithGoogle,
  loginWithApple,
  loginWithFacebook,
  loginWithTwitter,
  logout as logoutUserService,
} from "../services/authService";
import { getUserProfile, updateDayStreak, updateUserProfile } from "../services/userService";
import { getLanguages, getWritingSystems } from "../services/supportedLanguagesService";
import { getCategories } from "../services/categoriesService";
import { getTiersConfig } from "../services/tiersConfigService";
import { getFeatures } from "../services/featuresService";
import { ALL_FAVOURITE_FIELDS } from "../services/favouritesService";
import { registerAiConfirmHandler } from "../services/aiService";
import { normalizeCode } from "../utils/languageCode";
import { auth } from "../firebase";
import PropTypes from "prop-types";
import { getTranslations, clearTranslationsCache, fillMissingTranslations } from "../services/translationService";
import i18n, { loadRemoteTranslations, registerMissingKeyHandler, BASE_LOCALE } from "../i18n";
import Loader from "../components/Loader";
import { setSentryUser } from "../sentry";

const AppContext = createContext();

// How long one "yes" keeps covering follow-up AI calls. Long enough for a Full
// Exam's dozen sequential generations, short enough that the next thing the
// user does asks again.
const AI_CONFIRM_GRACE_MS = 90 * 1000;

/**
 * Only interrupt when the user is this close to their daily cap.
 *
 * Warning before every single call made the prompt noise rather than a signal —
 * the point is to stop someone spending their *last* calls without noticing,
 * not to gate all twenty. Tiers with no cap never see it at all, and the
 * dashboard header already shows the running count for everyone else.
 */
const AI_CONFIRM_WARN_AT_OR_BELOW = 2;

/** localStorage key holding the day the user last silenced the warning. */
const AI_CONFIRM_MUTED_KEY = "aiConfirmMutedDate";

/** Today as YYYY-MM-DD, matching the day-key the backend counts calls against. */
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Whether the user muted the warning earlier today. Deliberately scoped to the
 * day, not forever: the quota resets daily, so a permanent opt-out would let
 * someone silence it once and then run dry unwarned every day after.
 */
const isAiConfirmMutedToday = () => {
  try {
    return localStorage.getItem(AI_CONFIRM_MUTED_KEY) === todayKey();
  } catch {
    return false; // localStorage unavailable (SSG/sandboxed contexts)
  }
};

const muteAiConfirmForToday = () => {
  try {
    localStorage.setItem(AI_CONFIRM_MUTED_KEY, todayKey());
  } catch {
    // Non-fatal: the warning simply shows again next time.
  }
};

// ── Token validation interval (50 min — Firebase ID tokens expire after 1 hr)
const TOKEN_CHECK_INTERVAL_MS = 50 * 60 * 1000;

// Helper to get saved theme from localStorage (fallback for non-logged-in users)
const getSavedTheme = () => {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "dark";
  } catch {
    return false;
  }
};

// Helper to save theme to localStorage
const saveThemeToLocalStorage = (isDark) => {
  try {
    localStorage.setItem("theme", isDark ? "dark" : "light");
  } catch {
    // localStorage unavailable (SSG/sandboxed contexts)
  }
};

// Helper to get saved language from localStorage (fallback for non-logged-in users)
const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem("interfaceLang");
    return saved || "en-US";
  } catch {
    return "en-US";
  }
};

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(getSavedTheme());
  const [interfaceLang, setInterfaceLang] = useState(getSavedLanguage());
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(true);
  const [alert, setAlert] = useState({ show: false, type: "", message: "", action: null });
  const [user, setUser] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const tokenCheckRef = useRef(null);

  // ── Supported Languages & Writing Systems state ───────────────────────────
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [writingSystems, setWritingSystems] = useState([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [isLoadingWritingSystems, setIsLoadingWritingSystems] = useState(false);

  // ── Interest Categories state ──────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // ── Tier limits & feature access state ─────────────────────────────────
  // Both null until the Firestore config loads. useTierAccess reports
  // isReady:false meanwhile so callers hold instead of acting on values they
  // don't have yet.
  const [tiersConfig, setTiersConfig] = useState(null);
  const [features, setFeatures] = useState(null);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);

  // ── Full Exam session state ────────────────────────────────────────────
  const [examSession, setExamSession] = useState(null);

  // ── AI generation confirmation ─────────────────────────────────────────
  // Holds the pending prompt's resolver while the modal is open. Registered
  // into aiService so every billable call routes through it — see
  // registerAiConfirmHandler there for which calls are exempt.
  const [aiConfirm, setAiConfirm] = useState(null); // null | { open: true }
  const aiConfirmResolver = useRef(null);
  // One user action can fan out into many AI calls — a Full Exam generates a
  // dozen exercises in one go. Prompting per call would be unusable, so a
  // confirmation covers the burst it belongs to.
  const aiConfirmGraceUntil = useRef(0);
  // The handler below is registered once, so it can't close over `user` or
  // `tiersConfig` directly without going stale. A ref keeps the current quota
  // readable at call time.
  const aiQuotaRef = useRef({ unlimited: true, remaining: Infinity });

  // Mirror the current tier's allowance into the ref the confirm handler reads.
  // Same derivation as useTierAccess, kept here because the handler is outside
  // React's render cycle.
  useEffect(() => {
    const tier = user?.subscriptionTier ?? "explorer";
    const limits = tiersConfig?.[tier] ?? tiersConfig?.explorer;
    const perDay = limits?.aiCallsPerDay ?? Infinity;
    aiQuotaRef.current = {
      unlimited: perDay === Infinity,
      remaining: perDay === Infinity
        ? Infinity
        : Math.max(0, perDay - (user?.aiCallsToday ?? 0)),
    };
  }, [user, tiersConfig]);

  const showAlert = useCallback((type, message, action = null) => {
    setAlert({ show: true, type, message, action });
  }, []);

  const closeAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, show: false, action: null }));
  }, []);

  // ── Fetch supported languages and writing systems ───────────────────────
  // Runs for guests too — getLanguages()/getWritingSystems() fall back to an
  // anonymous Firebase session (getTokenOrAnonymous()) when nobody's signed in.
  const refreshSupportedLanguages = useCallback(async () => {
    setIsLoadingLanguages(true);
    setIsLoadingWritingSystems(true);
    try {
      const [langs, writings] = await Promise.all([
        getLanguages(),
        getWritingSystems(),
      ]);
      // Defensive safety net: collapse any case- or region-variant duplicates
      // that slipped into Firestore (e.g. "en" and "en-GB"), keeping the
      // first occurrence returned by the query.
      const seen = new Set();
      const dedupedLangs = langs.filter((lang) => {
        const key = normalizeCode(lang.code);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSupportedLanguages(dedupedLangs);
      setWritingSystems(writings);
    } catch (err) {
      showAlert("error", `Could not load supported languages: ${err.message}`);
    } finally {
      setIsLoadingLanguages(false);
      setIsLoadingWritingSystems(false);
    }
  }, [showAlert]);

  // Load languages on startup
  useEffect(() => {
    refreshSupportedLanguages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch interest categories ────────────────────────────────────────
  // Runs for guests too — getCategories() falls back to an anonymous
  // Firebase session (getTokenOrAnonymous()) when nobody's signed in.
  const refreshCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (err) {
      showAlert("error", `Could not load interest categories: ${err.message}`);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [showAlert]);

  // ── Fetch tier limits & feature access ───────────────────────────────
  // Runs for guests too — gating decisions are needed before sign-in, and
  // getTiersConfig() falls back to an anonymous session. The config is
  // required: without it the app can't tell what anyone is allowed to do, so a
  // failure goes to /app-unavailable like a failed translation load.
  const refreshTiersConfig = useCallback(async () => {
    setIsLoadingTiers(true);
    try {
      const [tiers, featureDocs] = await Promise.all([getTiersConfig(), getFeatures()]);
      setTiersConfig(tiers);
      setFeatures(featureDocs);
    } catch (err) {
      console.error(`[AppContext] Failed to load tier/feature config: ${err.message}`);
      navigate("/app-unavailable", { replace: true });
    } finally {
      setIsLoadingTiers(false);
    }
  }, [navigate]);

  // Load tier config on startup
  useEffect(() => {
    refreshTiersConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load categories on startup
  useEffect(() => {
    refreshCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick-switcher language list (Header/MobileMenuDrawer/Dashboard) — always
  // has at least English, even before Firestore has loaded/seeded anything.
  // Settings/Onboarding intentionally use the raw supportedLanguages instead,
  // since they have their own "Other"-seeding empty-state UX.
  const interfaceLanguageOptions = useMemo(() => {
    const fallback = { code: "en-US", label: "English", flag: "🇺🇸" };
    if (!supportedLanguages || supportedLanguages.length === 0) return [fallback];
    const hasEnglish = supportedLanguages.some((l) => l.code === fallback.code);
    return hasEnglish ? supportedLanguages : [fallback, ...supportedLanguages];
  }, [supportedLanguages]);

  const updateExamSection = useCallback((section, patch) =>
    setExamSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: {
            ...prev.sections[section],
            ...patch,
          },
        },
      };
    }), []);

  /**
   * Attempt to force-refresh the Firebase ID token.
   * Returns the fresh token on success, or null on failure (session expired).
   */
  const validateToken = useCallback(async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return null;
    try {
      const freshToken = await firebaseUser.getIdToken(true);
      return freshToken;
    } catch {
      return null;
    }
  }, []);

  /**
   * Called when we detect the token can no longer be refreshed.
   * Marks the session as expired and shows a persistent warning.
   */
  const handleTokenExpired = useCallback(() => {
    setTokenExpired(true);
    // Use a non-auto-dismissing alert so the user sees the warning
    setAlert({
      show: true,
      type: "error",
      message: "__SESSION_EXPIRED__", // sentinel; AlertMessage will resolve via i18n
    });
  }, []);

  /**
   * Dismiss the expired-session banner and attempt to recover by
   * re-validating the token (e.g. after the user re-authenticates).
   */
  const dismissTokenExpired = useCallback(() => {
    setTokenExpired(false);
    setAlert({ show: false, type: "", message: "", action: null });
  }, []);

  // ── Periodic token validation ──────────────────────────────────────────
  // Every TOKEN_CHECK_INTERVAL_MS, try to force-refresh the ID token.
  // If the refresh fails the session is considered expired.
  useEffect(() => {
    if (!auth) return;

    const startTokenCheck = () => {
      tokenCheckRef.current = setInterval(async () => {
        const token = await validateToken();
        if (!token && auth.currentUser) {
          handleTokenExpired();
        }
      }, TOKEN_CHECK_INTERVAL_MS);
    };

    startTokenCheck();

    return () => {
      if (tokenCheckRef.current) clearInterval(tokenCheckRef.current);
    };
  }, [validateToken, handleTokenExpired]);

  // ── Listen for auth state → clear expired flag when user re-auths ──────
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      // Tag error reports with the account that hit them. Anonymous guest
      // sessions stay unattributed — their uid is per-browser and would
      // just be noise.
      setSentryUser(
        firebaseUser && !firebaseUser.isAnonymous ? firebaseUser.uid : null
      );

      if (firebaseUser && !firebaseUser.isAnonymous && tokenExpired) {
        // User re-authenticated (e.g. signed in again from another tab)
        setTokenExpired(false);
        setAlert({ show: false, type: "", message: "", action: null });
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load translations for the current interface language ───────────────
  const loadTranslationsForLang = useCallback(async (lang, token) => {
    if (!lang) return;

    console.info(`[AppContext] loadTranslationsForLang("${lang}") — starting (hasToken=${Boolean(token)})`);
    setIsLoadingTranslations(true);
    try {
      // Clear cache so we get fresh data
      clearTranslationsCache();

      // Fetch translations from Firestore (falls back to the local base locale)
      const translations = await getTranslations(lang, token);

      // Register with i18next
      loadRemoteTranslations(lang, translations);

      // Change i18next language
      const i18nModule = await import("i18next");
      i18nModule.default.changeLanguage(lang);

      // Check for missing/absent translations and fill or seed them
      // (non-blocking). fillMissingTranslations() also handles the case
      // where "lang" has no Firestore doc at all yet — it detects that and
      // seeds the full document from the base locale instead of patching one
      // that doesn't exist.
      //
      // Skipped only for the base locale, which is the bundled source and has
      // nothing to translate from. en-US is a normal target like any other.
      if (token && lang !== BASE_LOCALE) {
        fillMissingTranslations(lang, token)
          .then((count) => {
            if (count > 0) {
              console.info(`[AppContext] loadTranslationsForLang("${lang}") — background fill/seed added ${count} key(s)`);
            }
          })
          .catch((err) =>
            console.warn(`[AppContext] fillMissingTranslations failed for "${lang}": ${err.message}`)
          );
      }
    } catch (err) {
      console.error(`[AppContext] Failed to load translations for "${lang}": ${err.message}`);
      // Navigate to app-unavailable on Firestore failure
      navigate("/app-unavailable", { replace: true });
      return;
    } finally {
      setIsLoadingTranslations(false);
    }
  }, [navigate]);

  // Ask before spending an AI call — but only when the answer could plausibly
  // be "no". Resolves true to proceed. Only one prompt can be open at a time; a
  // second request while one is pending is declined rather than queued, so a
  // burst can't stack modals.
  useEffect(() => {
    registerAiConfirmHandler(() => {
      const { unlimited, remaining } = aiQuotaRef.current;

      // Nothing to ration — Maestro, VIP and Admin are never interrupted.
      if (unlimited) return Promise.resolve(true);
      // Plenty of allowance left; the header counter is signal enough.
      if (remaining > AI_CONFIRM_WARN_AT_OR_BELOW) return Promise.resolve(true);
      // The user asked not to be warned again today.
      if (isAiConfirmMutedToday()) return Promise.resolve(true);
      // Still inside the window opened by a recent "yes" — this call is part of
      // the same action the user already approved.
      if (Date.now() < aiConfirmGraceUntil.current) return Promise.resolve(true);
      // A prompt is already on screen; decline rather than stack modals.
      if (aiConfirmResolver.current) return Promise.resolve(false);

      return new Promise((resolve) => {
        aiConfirmResolver.current = resolve;
        setAiConfirm({ open: true, remaining });
      });
    });
    return () => registerAiConfirmHandler(null);
  }, []);

  const resolveAiConfirm = useCallback((proceed, { muteToday = false } = {}) => {
    const resolve = aiConfirmResolver.current;
    aiConfirmResolver.current = null;
    setAiConfirm(null);
    // Only honour the checkbox on a "yes" — silencing the warning while
    // declining would be a confusing thing to have asked for.
    if (proceed && muteToday) muteAiConfirmForToday();
    // Approving covers the rest of this action's calls; declining clears any
    // window still open so the next action asks again.
    aiConfirmGraceUntil.current = proceed ? Date.now() + AI_CONFIRM_GRACE_MS : 0;
    resolve?.(proceed);
  }, []);

  // Register the fillMissingTranslations function with i18next so it
  // can be called when a translation key is missing at runtime
  useEffect(() => {
    registerMissingKeyHandler((locale) => {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) return Promise.resolve();
      return firebaseUser.getIdToken().then((token) =>
        fillMissingTranslations(locale, token)
      );
    });
  }, []);

  // Change interface language and persist
  const changeLanguage = useCallback(async (lang) => {
    setInterfaceLang(lang);
    try {
      localStorage.setItem("interfaceLang", lang);
    } catch {
      // localStorage unavailable
    }

    // Load translations for the new language
    const firebaseUser = auth?.currentUser;
    const token = firebaseUser ? await firebaseUser.getIdToken() : null;
    await loadTranslationsForLang(lang, token);

    // Persist to the profile for real (non-anonymous) logged-in users only —
    // guests/anonymous sessions stay local-only (localStorage above).
    if (firebaseUser && !firebaseUser.isAnonymous) {
      try {
        await updateUserProfile(token, firebaseUser.uid, { interfaceLang: lang });
        setUser((prev) => (prev ? { ...prev, interfaceLang: lang } : prev));
      } catch (err) {
        showAlert("error", `Could not save language preference: ${err.message}`);
      }
    }
  }, [loadTranslationsForLang, showAlert]);

  // Safe theme setter that persists to localStorage
  const setIsDarkModeWithPersist = (isDark) => {
    setIsDarkMode(isDark);
    saveThemeToLocalStorage(isDark);
  };

  /**
   * Load the Firestore profile and merge it into user state.
   *
   * Priority for displayName and photoURL:
   *   1. Firestore value  — set by the user in Settings (custom name / uploaded avatar)
   *   2. Auth provider    — Google / Facebook / Apple / X display name and photo
   *
   * All other profile fields (theme, interfaceLang,
   * learningDialect, interests, dayStreak, wordsFound,
   * highestDayStreak) come from Firestore only.
   *
   * @param {object} authUser - The raw Firebase Auth user object fields + token.
   *                            Used as fallback source for displayName and photoURL.
   */
  const loadUserProfile = async (authUser) => {
    if (!authUser?.token || !authUser?.uid) return;
    try {
      const profile = await getUserProfile(authUser.token, authUser.uid);

      // Theme — Firestore is source of truth; localStorage is fallback for guests
      if (profile?.theme) {
        setIsDarkMode(profile.theme === "dark");
        saveThemeToLocalStorage(profile.theme === "dark");
      }

      // Language — Firestore → localStorage → default
      const lang =
        profile?.interfaceLang || localStorage.getItem("interfaceLang") || "en-US";
      setInterfaceLang(lang);
      try {
        localStorage.setItem("interfaceLang", lang);
      } catch {
        // localStorage unavailable
      }

      // Day streak — update in Firestore (no-op if already updated today)
      // Returns { dayStreak, highestDayStreak } — current or newly updated values.
      const { dayStreak, highestDayStreak } = await updateDayStreak(authUser.token, authUser.uid, profile);

      // Words found — derived from the length of seenConceptIds (no extra read needed)
      const wordsFound = profile?.seenConceptIds?.length ?? 0;

      // Seen exercise IDs — tracked per type for exam training features
      const seenExerciseIds = profile?.seenExerciseIds ?? { reading: [], listening: [], writing: [] };

      // Seen stories and History & Culture facts — own top-level fields,
      // hydrated here so neither feature needs a second profile read just to
      // know what's already been shown.
      const seenStoryIds = profile?.seenStoryIds ?? [];
      const seenHistoryFactsIds = profile?.seenHistoryFactsIds ?? [];

      // Favourites — every `fav*` field the service knows about, copied across
      // as a group. Without this the hearts reset on every page load: the
      // toggle writes to Firestore and updates AppContext, but a reload
      // rebuilds `user` from the whitelist below and the ids never came back.
      // Driven off ALL_FAVOURITE_FIELDS so adding a kind stays a one-line
      // change in favouritesService, as CLAUDE.md promises.
      const favouriteFields = Object.fromEntries(
        ALL_FAVOURITE_FIELDS.map((field) => [field, profile?.[field] ?? []]),
      );

      setUser((prev) => ({
        ...prev,
        // displayName: Firestore → auth provider → keep previous
        displayName: profile?.displayName || authUser?.displayName || prev?.displayName,
        // photoURL: Firestore → auth provider → keep previous
        photoURL: profile?.photoURL || authUser?.photoURL || prev?.photoURL,
        interfaceLang: lang,
        theme: profile?.theme ?? "light",
        // ── Learning profile fields ──────────────────────────────────────────
        // learningDialect: Firestore value only — null means onboarding not completed
        learningDialect: profile?.learningDialect ?? null,
        // interests: Firestore → keep previous → empty array
        interests: profile?.interests ?? prev?.interests ?? [],
        // onboardingCompleted: Firestore flag — used by RequireOnboarding guard
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        // ── Subscription / tier fields ───────────────────────────────────────
        subscriptionTier: profile?.subscriptionTier ?? "explorer",
        subscriptionStatus: profile?.subscriptionStatus ?? null,
        currentPeriodEnd: profile?.currentPeriodEnd ?? null,
        aiCallsToday: profile?.aiCallsToday ?? 0,
        aiCallsDate: profile?.aiCallsDate ?? null,
        // ── Stats fields ─────────────────────────────────────────────────────
        dayStreak,
        highestDayStreak,
        wordsFound,
        seenExerciseIds,
        seenStoryIds,
        seenHistoryFactsIds,
        ...favouriteFields,
        // ── Preferences ──────────────────────────────────────────────────────
        // Absent means "not chosen yet", which useDashboardPresentation
        // resolves by viewport rather than by guessing a default here.
        dashboardPresentation: profile?.dashboardPresentation ?? null,
        // Notification opt-outs. Left undefined when unset so the Settings
        // card renders the defaults — the backend applies the same defaults
        // at send time, and it is the backend's check that actually counts.
        notificationPrefs: profile?.notificationPrefs ?? null,
        // Per-browser FCM registration tokens. Needed here so enabling or
        // disabling push can append/remove this browser without clobbering
        // the user's other devices.
        fcmTokens: profile?.fcmTokens ?? [],
      }));
    } catch (err) {
      // A brand-new account always lands here once. signInWithPopup fires
      // onAuthStateChanged as soon as the popup closes, which starts this
      // read before POST /api/auth has finished creating users/{uid} — so
      // the first attempt 404s. The sign-in then completes with the custom
      // token, onAuthStateChanged fires again, and the retry succeeds.
      //
      // Nothing is wrong at that moment, so it gets the good news rather
      // than an error the user can do nothing about.
      if (err.status === 404) {
        showAlert("success", i18n.t("login.account_created"));
        return;
      }
      showAlert("error", `Could not load your profile: ${err.message}`);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const refreshUser = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken(true);
    const authUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      token,
    };
    // Only set non-profile fields immediately — displayName and photoURL
    // are resolved by loadUserProfile (Firestore first, auth provider fallback)
    setUser((prev) => ({
      ...prev,
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      token: authUser.token,
    }));
    await loadUserProfile(authUser);
  };

  // Sync interfaceLang changes to i18next and load remote translations
  useEffect(() => {
    const loadInitialTranslations = async () => {
      const firebaseUser = auth?.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      await loadTranslationsForLang(interfaceLang, token);
    };
    loadInitialTranslations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistent auth listener — stays alive for the app lifetime so token
  // refreshes, custom-token re-auth, and session changes are always reflected.
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      // Anonymous sessions (used to let guests read public data like
      // translations) must never be treated as a real logged-in user.
      if (firebaseUser && !firebaseUser.isAnonymous) {
        const token = await firebaseUser.getIdToken();
        const authUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          token,
        };
        // Only set non-profile fields immediately — displayName and photoURL
        // are resolved by loadUserProfile (Firestore first, auth provider fallback)
        setUser((prev) => ({
          ...prev,
          uid: authUser.uid,
          email: authUser.email,
          emailVerified: authUser.emailVerified,
          token: authUser.token,
        }));
        loadUserProfile(authUser);
      } else {
        setUser(null);
        setIsLoadingUser(false);
        const savedTheme = getSavedTheme();
        setIsDarkMode(savedTheme);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginGoogle = async () => {
    try {
      const result = await loginWithGoogle();
      // Do NOT call setUser or loadUserProfile here — onAuthStateChanged fires
      // immediately after signInWithCustomToken and handles both.
      return result;
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const loginApple = async () => {
    try {
      return await loginWithApple();
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const loginFacebook = async () => {
    try {
      return await loginWithFacebook();
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const loginTwitter = async () => {
    try {
      return await loginWithTwitter();
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  const logoutUser = async () => {
    try {
      await logoutUserService();
      setUser(null);
      setIsDarkMode(false);
      setExamSession(null);
      return { success: true };
    } catch (e) {
      showAlert("error", e.message);
      return { success: false };
    }
  };

  // Show full-page loading while translations are being fetched
  if (isLoadingTranslations) {
    return <Loader isDarkMode={isDarkMode} fullScreen message="Loading translations..." />;
  }

  return (
    <AppContext.Provider
      value={{
        isDarkMode,
        setIsDarkMode: setIsDarkModeWithPersist,
        interfaceLang,
        changeLanguage,
        alert,
        showAlert,
        closeAlert,
        user,
        setUser,
        isLoadingUser,
        isLoadingTranslations,
        loginGoogle,
        loginApple,
        loginFacebook,
        loginTwitter,
        logoutUser,
        refreshUser,
        tokenExpired,
        handleTokenExpired,
        dismissTokenExpired,
        validateToken,
        // Supported languages & writing systems
        supportedLanguages,
        interfaceLanguageOptions,
        writingSystems,
        isLoadingLanguages,
        isLoadingWritingSystems,
        refreshSupportedLanguages,
        // Interest categories
        categories,
        isLoadingCategories,
        refreshCategories,
        // Tier limits & feature access
        tiersConfig,
        features,
        isLoadingTiers,
        refreshTiersConfig,
        // Full Exam session
        examSession,
        setExamSession,
        updateExamSection,
        // AI generation confirmation
        aiConfirm,
        resolveAiConfirm,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

AppProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(AppContext);


