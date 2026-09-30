/**
 * useAiError.js
 *
 * What a screen says when an AI call fails. The daily limit is the one failure
 * a retry cannot fix, so it gets the way to more calls instead of "Try again".
 *
 * Two shapes, for the two ways screens report errors:
 *
 *   // A screen with its own error panel keeps the message and its kind.
 *   const { error, isLimitError, setError, failWith } = useAiErrorState();
 *   setError(null);                        // clear, or set a plain message
 *   failWith(err, t("dictionary.error_failed"));  // from a catch
 *   {isLimitError && <PlansLink />}
 *
 *   // A screen that only raises an alert.
 *   const alertAiError = useAiErrorAlert();
 *   alertAiError(err, { message, retry: handleGenerate });
 *
 * A declined spend prompt is not a failure: check `isAiDeclined` first, as
 * the call sites already do.
 */

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { isDailyLimit } from "../utils/aiUsage";

export function useAiErrorState() {
  const [state, setState] = useState(null); // null | { message, isLimit }

  const setError = useCallback((message) => {
    setState(message ? { message, isLimit: false } : null);
  }, []);

  const failWith = useCallback((err, message) => {
    setState({ message: message || err?.message || "", isLimit: isDailyLimit(err) });
  }, []);

  return {
    error: state?.message || null,
    isLimitError: Boolean(state?.isLimit),
    setError,
    failWith,
  };
}

export function useAiErrorAlert() {
  const { showAlert, showDailyLimitAlert } = useAppContext();
  const { t } = useTranslation();

  return useCallback((err, { message, retry } = {}) => {
    if (isDailyLimit(err)) {
      showDailyLimitAlert();
      return;
    }
    showAlert(
      "error",
      message || err?.message || t("common.error", "Something went wrong. Please try again."),
      retry ? { label: t("common.try_again", "Try Again"), onClick: retry } : undefined,
    );
  }, [showAlert, showDailyLimitAlert, t]);
}
