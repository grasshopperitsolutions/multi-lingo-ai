import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * Out of AI calls, every screen offers the plans instead of a retry the
 * server would only refuse. The provider's side (the alert itself, failing a
 * call before it is sent) is in dailyLimitProvider.test.jsx.
 */

const ctx = { current: makeAppContext() };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const lookupWord = vi.fn();
vi.mock("../../src/services/dictionaryService", () => ({
  lookupWord: (...a) => lookupWord(...a),
}));

const limitError = () => Object.assign(new Error("Já usaste todas as tuas chamadas de IA por hoje."), { code: "DAILY_LIMIT" });

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = makeAppContext({ user: { uid: "u1", token: "tok", favWordIds: [] }, interfaceLang: "en-US" });
});

const withProviders = async (ui) => {
  const { default: i18n } = await import("../../src/i18n");
  const utils = render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );
  return { ...utils, i18n };
};

describe("useAiErrorAlert", () => {
  it("answers the limit with the limit alert, never a retry", async () => {
    const { useAiErrorAlert } = await import("../../src/hooks/useAiError");
    const { result } = renderHook(() => useAiErrorAlert());
    const retry = vi.fn();

    result.current(limitError(), { message: "Could not load.", retry });

    expect(ctx.current.showDailyLimitAlert).toHaveBeenCalledTimes(1);
    expect(ctx.current.showAlert).not.toHaveBeenCalled();
  });

  it("offers a retry for anything else", async () => {
    const { useAiErrorAlert } = await import("../../src/hooks/useAiError");
    const { default: i18n } = await import("../../src/i18n");
    const { result } = renderHook(() => useAiErrorAlert());
    const retry = vi.fn();

    result.current(new Error("Network down"), { message: "Could not load.", retry });

    expect(ctx.current.showDailyLimitAlert).not.toHaveBeenCalled();
    expect(ctx.current.showAlert).toHaveBeenCalledWith("error", "Could not load.", {
      label: i18n.t("common.try_again"),
      onClick: retry,
    });
  });
});

describe("useAiErrorState", () => {
  it("remembers whether the limit was the cause, and forgets on clear", async () => {
    const { useAiErrorState } = await import("../../src/hooks/useAiError");
    const { result } = renderHook(() => useAiErrorState());

    act(() => result.current.failWith(limitError(), "Out of calls."));
    expect(result.current).toMatchObject({ error: "Out of calls.", isLimitError: true });

    act(() => result.current.failWith(new Error("boom"), "Something broke."));
    expect(result.current).toMatchObject({ error: "Something broke.", isLimitError: false });

    act(() => result.current.setError(null));
    expect(result.current).toMatchObject({ error: null, isLimitError: false });
  });
});

describe("the word lookup sheet", () => {
  const mount = async () => {
    const { default: WordLookupSheet } = await import("../../src/components/WordLookupSheet");
    return withProviders(
      <WordLookupSheet word="foram" sentence="Eles foram." targetLang="pt-PT" isDarkMode={false} onClose={vi.fn()} />,
    );
  };

  it("links to the plans under the limit message", async () => {
    lookupWord.mockRejectedValue(limitError());
    const { i18n } = await mount();

    const link = await screen.findByRole("link", { name: i18n.t("ai_usage.see_plans") });
    expect(link.getAttribute("href")).toBe("/pricing");
    expect(screen.getByText(/Já usaste todas/)).toBeTruthy();
  });

  it("shows no link for any other failure", async () => {
    lookupWord.mockRejectedValue(new Error("Network down"));
    const { i18n } = await mount();

    await screen.findByText("Network down");
    expect(screen.queryByRole("link", { name: i18n.t("ai_usage.see_plans") })).toBeNull();
  });
});

describe("the calls-left warning", () => {
  it("offers the plans, which declines this call and leaves", async () => {
    ctx.current = makeAppContext({ aiConfirm: { open: true, remaining: 1 } });
    const { default: AiGenerationConfirm } = await import("../../src/components/AiGenerationConfirm");
    const { i18n } = await withProviders(<AiGenerationConfirm />);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("ai_usage.see_plans") }));

    expect(ctx.current.resolveAiConfirm).toHaveBeenCalledWith(false, { toPlans: true });
  });
});
