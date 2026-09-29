import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";
import { resolvePracticeLevel, DEFAULT_PRACTICE_LEVEL } from "../../src/config/examLevels";

/**
 * The default practice level: one per practice language, set in Settings,
 * where every level picker in the app starts.
 *
 * A pick inside a feature is for that visit only. It must never move the
 * default, and the default must still show through on a page that mounted
 * before the profile arrived.
 */

const ctx = { current: null };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const updateUserProfile = vi.fn(async () => ({}));
vi.mock("../../src/services/userService", () => ({
  updateUserProfile: (...a) => updateUserProfile(...a),
  uploadProfileImage: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../../src/firebase", () => ({
  auth: { currentUser: { uid: "u1", getIdToken: async () => "tok" } },
  default: {},
  getMessagingIfSupported: vi.fn(async () => null),
}));

// Settings cards that fetch on mount and have nothing to do with the level.
vi.mock("../../src/components/NotificationSettings", () => ({ default: () => null }));
vi.mock("../../src/components/ReminderSettings", () => ({ default: () => null }));
vi.mock("../../src/components/TutorProfileSection", () => ({ default: () => null }));
vi.mock("../../src/components/personal/PersonalWidgetSettings", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePracticeLevel", () => {
  it("reads the level stored for that practice language", () => {
    expect(resolvePracticeLevel({ "pt-PT": "B2", "ja-JP": "A1" }, "pt-PT")).toBe("B2");
    expect(resolvePracticeLevel({ "pt-PT": "B2", "ja-JP": "A1" }, "ja-JP")).toBe("A1");
  });

  it("does not carry one language's level into another", () => {
    // B2 in Portuguese says nothing about someone starting Japanese.
    expect(resolvePracticeLevel({ "pt-PT": "B2" }, "ja-JP")).toBe(DEFAULT_PRACTICE_LEVEL);
  });

  it("falls back to A1 when nothing usable is stored", () => {
    expect(resolvePracticeLevel(null, "pt-PT")).toBe("A1");
    expect(resolvePracticeLevel({ "pt-PT": "Z9" }, "pt-PT")).toBe("A1");
    expect(resolvePracticeLevel({ "pt-PT": "B1" }, null)).toBe("A1");
  });
});

describe("usePracticeLevel", () => {
  const withUser = (user) => {
    ctx.current = makeAppContext({ user });
  };

  async function mountProbe() {
    const { usePracticeLevel } = await import("../../src/hooks/usePracticeLevel");
    let api;
    const Probe = () => {
      api = usePracticeLevel();
      return <p>level:{api.level}</p>;
    };
    const result = render(<Probe />);
    return { ...result, api: () => api, Probe };
  }

  it("starts from the default for the practice language", async () => {
    withUser({ uid: "u1", learningDialect: "pt-PT", practiceLevels: { "pt-PT": "B1" } });
    await mountProbe();
    expect(screen.getByText("level:B1")).toBeTruthy();
  });

  it("keeps a pick for the page without touching the default", async () => {
    withUser({ uid: "u1", learningDialect: "pt-PT", practiceLevels: { "pt-PT": "B1" } });
    const { api } = await mountProbe();

    act(() => api().setLevel("C1"));
    expect(screen.getByText("level:C1")).toBeTruthy();
    expect(api().defaultLevel).toBe("B1");
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("follows a default that arrives after the page mounted", async () => {
    // The profile can land after the page: the context user is set from auth
    // first, and the profile fields follow.
    withUser({ uid: "u1", learningDialect: "pt-PT" });
    const { rerender, Probe } = await mountProbe();
    expect(screen.getByText("level:A1")).toBeTruthy();

    withUser({ uid: "u1", learningDialect: "pt-PT", practiceLevels: { "pt-PT": "B2" } });
    rerender(<Probe />);
    expect(screen.getByText("level:B2")).toBeTruthy();
  });

  it("goes back to following the default when handed null", async () => {
    withUser({ uid: "u1", learningDialect: "pt-PT", practiceLevels: { "pt-PT": "B1" } });
    const { api } = await mountProbe();

    act(() => api().setLevel("C2"));
    act(() => api().setLevel(null));
    expect(screen.getByText("level:B1")).toBeTruthy();
  });
});

describe("DefaultLevelLink", () => {
  it("shows the default and links to the practice-language card", async () => {
    ctx.current = makeAppContext({
      user: { uid: "u1", learningDialect: "pt-PT", practiceLevels: { "pt-PT": "B2" } },
    });
    const { default: i18n } = await import("../../src/i18n");
    const { default: DefaultLevelLink } = await import("../../src/components/DefaultLevelLink");

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <DefaultLevelLink />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByText("B2")).toBeTruthy();
    // The hash is what opens the card and scrolls to it, rather than landing
    // on a page of closed cards.
    expect(screen.getByRole("link").getAttribute("href")).toBe("/settings#practiceLanguage");
  });
});

describe("the Settings picker", () => {
  async function mountSettings(user) {
    const setUser = vi.fn();
    const showAlert = vi.fn();
    ctx.current = makeAppContext({
      user: { uid: "u1", token: "tok", interfaceLang: "pt-PT", ...user },
      setUser,
      showAlert,
      supportedLanguages: [
        { code: "pt-PT", label: "Português (Portugal)" },
        { code: "ja-JP", label: "日本語" },
      ],
    });
    const { default: i18n } = await import("../../src/i18n");
    const { default: SettingsPage } = await import("../../src/pages/SettingsPage");
    const result = render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/settings#practiceLanguage"]}>
          <SettingsPage />
        </MemoryRouter>
      </I18nextProvider>,
    );
    return { ...result, setUser, showAlert, i18n };
  }

  async function pickLevel(result, i18n, level) {
    const section = result.container.querySelector("#practiceLanguage");
    const label = i18n.t(`exam.levels.${level.toLowerCase()}`);
    // The card opens itself from the browser's hash, which a MemoryRouter
    // does not set, so open it the way a reader would: by its header.
    fireEvent.click(within(section).getByRole("button", { name: i18n.t("settings.language_learning") }));
    // The level picker is the dropdown showing a CEFR level.
    const buttons = within(section).getAllByRole("button");
    const levelButton = buttons.find((b) => /A1|A2|B1|B2|C1|C2/.test(b.textContent));
    fireEvent.click(levelButton);
    fireEvent.click(within(section).getByText(label));
  }

  it("saves at once, for the language in the form, keeping the other languages", async () => {
    const result = await mountSettings({
      learningDialect: "pt-PT",
      practiceLevels: { "ja-JP": "A2" },
    });

    await pickLevel(result, result.i18n, "B1");

    // Only the level map is written, and written whole: no dotted field path.
    await waitFor(() =>
      expect(updateUserProfile).toHaveBeenCalledWith("tok", "u1", {
        practiceLevels: { "ja-JP": "A2", "pt-PT": "B1" },
      }),
    );
  });

  it("puts the old value back if the write fails", async () => {
    updateUserProfile.mockRejectedValueOnce(new Error("offline"));
    const result = await mountSettings({
      learningDialect: "pt-PT",
      practiceLevels: { "pt-PT": "A2" },
    });

    await pickLevel(result, result.i18n, "C1");

    await waitFor(() => expect(result.showAlert).toHaveBeenCalledWith("error", "offline"));
    // First the optimistic value, then the rollback to what was there.
    const updates = result.setUser.mock.calls.map(([fn]) => fn({ uid: "u1" }).practiceLevels);
    expect(updates).toContainEqual({ "pt-PT": "C1" });
    expect(updates[updates.length - 1]).toEqual({ "pt-PT": "A2" });
  });
});
