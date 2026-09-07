import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The remaining transport and policy services: the AI gateway, exam scoring,
 * push availability, storage uploads and Stripe entry points.
 *
 * These sit between the UI and money, quotas or the user's browser
 * permissions, so the behaviour worth pinning is what they do when something
 * says no — a declined generation, a 429, an unsupported browser, a failed
 * upload.
 */

const PROXY = "https://multi-lingo-ai-api.vercel.app";

// getTokenOrAnonymous() reaches Firebase Auth for a signed-out visitor, which
// in jsdom fails as auth/network-request-failed.
vi.mock("../../src/services/firestoreService", async (importOriginal) => ({
  ...(await importOriginal()),
  getTokenOrAnonymous: vi.fn(async () => "anon-tok"),
}));

const okJson = (data, { ok = true, status = 200 } = {}) =>
  vi.fn(async () => ({ ok, status, json: async () => data }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

describe("aiService.askAI", () => {
  const load = () => import("../../src/services/aiService");

  it("returns the data field from the envelope", async () => {
    globalThis.fetch = okJson({ success: true, data: { text: "olá" } });

    const { askAI } = await load();
    const result = await askAI("tok", "prompt", {}, { skipConfirm: true });

    expect(result).toEqual({ text: "olá" });
  });

  it("posts to the ask-ai endpoint with the bearer token", async () => {
    globalThis.fetch = okJson({ success: true, data: {} });

    const { askAI } = await load();
    await askAI("tok-9", "prompt", { model: "x" }, { skipConfirm: true });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(`${PROXY}/api/ask-ai`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok-9");
    expect(JSON.parse(init.body).prompt).toBe("prompt");
  });

  it("asks the confirmation handler before spending a call", async () => {
    globalThis.fetch = okJson({ success: true, data: {} });

    const { askAI, registerAiConfirmHandler } = await load();
    const confirm = vi.fn(async () => true);
    registerAiConfirmHandler(confirm);

    await askAI("tok", "prompt", {});

    expect(confirm).toHaveBeenCalled();
  });

  it("throws a recognisable error and makes no request when the user declines", async () => {
    globalThis.fetch = okJson({ success: true, data: {} });

    const { askAI, registerAiConfirmHandler, isAiDeclined } = await load();
    registerAiConfirmHandler(async () => false);

    const err = await askAI("tok", "prompt", {}).catch((e) => e);

    // A decline is not a failure — callers use isAiDeclined to stay silent
    // rather than showing an error toast.
    expect(isAiDeclined(err)).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("skips the prompt for background calls", async () => {
    globalThis.fetch = okJson({ success: true, data: {} });

    const { askAI, registerAiConfirmHandler } = await load();
    const confirm = vi.fn(async () => true);
    registerAiConfirmHandler(confirm);

    // Tutor URL validation is one of these: the user pressed a button that
    // happens to use AI, not "generate me something".
    await askAI("tok", "prompt", {}, { skipConfirm: true });

    expect(confirm).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("surfaces the API's error message on a failure", async () => {
    globalThis.fetch = okJson({ error: "Daily limit reached" }, { ok: false, status: 429 });

    const { askAI } = await load();
    await expect(askAI("tok", "p", {}, { skipConfirm: true })).rejects.toThrow(
      /Daily limit reached/,
    );
  });

  it("does not treat an ordinary error as a decline", async () => {
    const { isAiDeclined } = await load();
    expect(isAiDeclined(new Error("network"))).toBe(false);
    expect(isAiDeclined(null)).toBe(false);
  });
});

describe("examUtils scoring", () => {
  const questions = [
    { id: "q1", text: "A?", correctAnswer: "a" },
    { id: "q2", text: "B?", correctAnswer: "b" },
    { id: "q3", text: "C?", correctAnswer: "c" },
  ];

  it("scores a perfect paper", async () => {
    const { checkAnswers } = await import("../../src/services/examUtils");

    const result = checkAnswers(
      [
        { questionId: "q1", selectedAnswer: "a" },
        { questionId: "q2", selectedAnswer: "b" },
        { questionId: "q3", selectedAnswer: "c" },
      ],
      questions,
    );

    expect(result.score).toBe(3);
    expect(result.maxScore).toBe(3);
    expect(result.breakdown.every((b) => b.isCorrect)).toBe(true);
  });

  it("counts a skipped question as wrong, not as absent", async () => {
    const { checkAnswers } = await import("../../src/services/examUtils");

    const result = checkAnswers([{ questionId: "q1", selectedAnswer: "a" }], questions);

    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(3);

    const skipped = result.breakdown.find((b) => b.questionId === "q2");
    expect(skipped.isCorrect).toBe(false);
    expect(skipped.userAnswer).toBeNull();
  });

  it("reports the correct answer for every question, right or wrong", async () => {
    const { checkAnswers } = await import("../../src/services/examUtils");

    const result = checkAnswers([{ questionId: "q1", selectedAnswer: "wrong" }], questions);

    for (const row of result.breakdown) {
      expect(row.correctAnswer).toBeTruthy();
    }
  });

  it("scores an empty paper as zero rather than throwing", async () => {
    const { checkAnswers } = await import("../../src/services/examUtils");

    const result = checkAnswers([], questions);
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(3);
  });

  it("rejects malformed input loudly", async () => {
    const { checkAnswers } = await import("../../src/services/examUtils");

    expect(() => checkAnswers(null, questions)).toThrow(/must be an array/);
    expect(() => checkAnswers([], null)).toThrow(/must be an array/);
  });

  it("gives listening and reading the same scoring contract", async () => {
    const { checkListeningAnswers, checkReadingAnswers } = await import(
      "../../src/services/examUtils"
    );

    const answers = [{ questionId: "q1", selectedAnswer: "a" }];
    for (const fn of [checkListeningAnswers, checkReadingAnswers]) {
      const result = fn(answers, questions);
      expect(result.maxScore).toBe(3);
      expect(result.score).toBe(1);
    }
  });

  it("returns a colour for every score band", async () => {
    const { getScoreColor } = await import("../../src/services/examUtils");

    for (const score of [0, 1, 2, 3]) {
      expect(typeof getScoreColor(score, 3, false)).toBe("string");
      expect(getScoreColor(score, 3, true)).toBeTruthy();
    }
  });
});

describe("notificationService push availability", () => {
  it("reports unsupported when the browser has no Notification API", async () => {
    const original = globalThis.Notification;
    delete globalThis.Notification;

    const { isPushAvailable, getPushPermission } = await import(
      "../../src/services/notificationService"
    );

    expect(isPushAvailable()).toBe(false);
    // 'unsupported' rather than 'denied': the user has refused nothing, so the
    // UI must not offer to send them to browser settings.
    expect(getPushPermission()).toBe("unsupported");

    if (original) globalThis.Notification = original;
  });

  it("sends a contact message through the proxy", async () => {
    globalThis.fetch = okJson({ success: true, data: { ok: true } });

    const { sendContactMessage } = await import("../../src/services/notificationService");
    await sendContactMessage({ name: "Ana", email: "a@x.com", message: "Olá" });

    expect(globalThis.fetch).toHaveBeenCalled();
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(init.body).message).toBe("Olá");
  });
});

describe("stripeService", () => {
  it("redirects to the checkout URL read from inside the envelope", async () => {
    globalThis.fetch = okJson({ success: true, data: { url: "https://checkout.stripe" } });

    // It navigates rather than returning; jsdom refuses a real navigation, so
    // the assignment target is replaced with a plain object.
    const original = window.location;
    delete window.location;
    window.location = { href: "" };

    const { createCheckoutSession } = await import("../../src/services/stripeService");
    await createCheckoutSession("tok", "maestro", "month");

    // Reading json.url instead of json.data.url is exactly how checkout
    // silently broke once.
    expect(window.location.href).toBe("https://checkout.stripe");
    window.location = original;
  });

  it("throws rather than navigating nowhere when no URL comes back", async () => {
    globalThis.fetch = okJson({ success: true, data: {} });

    const { createCheckoutSession } = await import("../../src/services/stripeService");
    await expect(createCheckoutSession("tok", "maestro", "month")).rejects.toThrow(
      /No checkout URL/,
    );
  });

  it("throws when Stripe refuses rather than returning undefined", async () => {
    globalThis.fetch = okJson({ error: "No such price" }, { ok: false, status: 400 });

    const { createCheckoutSession } = await import("../../src/services/stripeService");
    await expect(createCheckoutSession("tok", "bad", "month")).rejects.toThrow(/No such price/);
  });
});

describe("storageService", () => {
  it("requests an upload slot and returns the signed target", async () => {
    globalThis.fetch = okJson({
      success: true,
      data: { uploadUrl: "https://gcs/put", path: "users/u1/a.png" },
    });

    const { requestUpload } = await import("../../src/services/storageService");
    const slot = await requestUpload("tok", { path: "users/u1/a.png", contentType: "image/png" });

    expect(slot.uploadUrl).toBe("https://gcs/put");
  });

  it("reports an upload failure instead of resolving quietly", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));

    const { uploadToGcs } = await import("../../src/services/storageService");
    const blob = new Blob(["x"], { type: "image/png" });

    // A silent success here would leave a profile pointing at a file that was
    // never written.
    await expect(uploadToGcs("https://gcs/put", blob, "image/png")).rejects.toThrow();
  });
});
