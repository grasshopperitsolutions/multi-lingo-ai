import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The tutor profile editor.
 *
 * Covers the controls that only appear once there is a saved profile, which
 * is why they cannot be checked against the dev server: the account used for
 * browser testing has no tutor document, and creating one would write a real
 * public profile to production Firestore.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/firebase", () => ({
  auth: {
    currentUser: {
      uid: "u1",
      displayName: "Nuno",
      email: "nuno@example.com",
      photoURL: "https://cdn.example/me.png",
      getIdToken: async () => "tok",
    },
  },
  default: {},
  getMessagingIfSupported: vi.fn(async () => null),
}));

const getTutorProfile = vi.fn();
const saveTutorProfile = vi.fn(async () => ({}));
const unpublishTutorProfile = vi.fn(async () => ({}));

vi.mock("../../src/services/tutorService", async (importOriginal) => ({
  ...(await importOriginal()),
  getTutorProfile: (...a) => getTutorProfile(...a),
  saveTutorProfile: (...a) => saveTutorProfile(...a),
  unpublishTutorProfile: (...a) => unpublishTutorProfile(...a),
}));

const seedLanguage = vi.fn(async (code) => ({ id: code }));
vi.mock("../../src/services/supportedLanguagesService", async (importOriginal) => ({
  ...(await importOriginal()),
  seedLanguage: (...a) => seedLanguage(...a),
}));

const SAVED_PROFILE = {
  displayName: "Nuno",
  description: "Portuguese tutor",
  phone: "+351912345678",
  whatsapp: true,
  links: [],
  languages: ["pt-PT"],
  published: true,
  createdAt: "2026-09-01T00:00:00Z",
};

const user = {
  uid: "u1",
  displayName: "Nuno",
  email: "nuno@example.com",
  photoURL: "https://cdn.example/me.png",
  subscriptionTier: "maestro",
};

const SUPPORTED_LANGUAGES = [
  { code: "pt-PT", label: "Português" },
  { code: "en-US", label: "English" },
  { code: "es-ES", label: "Español" },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = "";
  ctx.current = makeAppContext({
    user,
    token: "tok",
    tiersConfig: {
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: ["real_person_tutor"],
      },
    },
    features: [],
    supportedLanguages: SUPPORTED_LANGUAGES,
    refreshSupportedLanguages: vi.fn(async () => {}),
  });
  getTutorProfile.mockResolvedValue(SAVED_PROFILE);
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

const mount = async (props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: TutorProfileSection } = await import(
    "../../src/components/TutorProfileSection"
  );

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <TutorProfileSection isDarkMode={false} user={user} defaultOpen {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe("tutor profile editor", () => {
  it("offers no photo field — the picture comes from the account", async () => {
    const { container } = await mount();

    await waitFor(() => expect(container.querySelector("textarea")).not.toBeNull());

    // Not "no url input at all" — each link row is one. The photo field was
    // a URL box whose *placeholder* was the account picture, so leaving it
    // alone saved photoURL: null and the directory card rendered no image.
    // What must be gone is any input carrying the account picture.
    const urlInputs = [...container.querySelectorAll('input[type="url"]')];
    for (const input of urlInputs) {
      expect(input.value).not.toBe(user.photoURL);
      expect(input.placeholder).not.toBe(user.photoURL);
    }

    // Exactly one url input: the single empty link row this profile starts
    // with. A second would be the photo field coming back.
    expect(urlInputs).toHaveLength(1);
  });

  it("splits a stored phone number across the country picker and the field", async () => {
    const { container } = await mount();

    await waitFor(() => expect(container.querySelector("select")).not.toBeNull());

    expect(container.querySelector("select").value).toBe("PT");
    expect(container.querySelector('input[type="tel"]').value).toBe("912345678");
  });

  it("starts collapsed when told to, rendering no inputs", async () => {
    const { container } = await mount({ defaultOpen: false });

    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0));
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
  });

  it("renders nothing at all when no tutor document exists yet", async () => {
    // The gate this feature exists for: no "start filling this in and it'll
    // be created on Save" — the editor stays hidden until a document already
    // exists (created only by "Become a tutor" on the directory page).
    getTutorProfile.mockResolvedValue(null);

    const { container } = await mount();

    // Give the async fetch a tick to resolve, then assert the settled state
    // is genuinely empty, not just "hasn't rendered yet".
    await waitFor(() => expect(getTutorProfile).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent.trim()).toBe("");
  });
});

describe("languages spoken", () => {
  it("shows the languages already on the profile as removable pills", async () => {
    const { container, getByText } = await mount();

    await waitFor(() => expect(getByText("Português")).toBeInTheDocument());
    // One pill, one remove control on it.
    expect(container.querySelectorAll('button[aria-label]')).not.toHaveLength(0);
  });

  it("adds a known language from the picker", async () => {
    const { container, getByText, findByText } = await mount();
    await waitFor(() => expect(container.querySelector("textarea")).not.toBeNull());

    // Open the language-add dropdown (the one offering flagCode options) and
    // pick a known language from the list.
    const dropdownButtons = [...container.querySelectorAll("button")];
    const addLanguageButton = dropdownButtons.find((b) =>
      /Adicionar l[ií]ngua/i.test(b.textContent),
    );
    expect(addLanguageButton).toBeDefined();
    addLanguageButton.click();

    const option = await findByText("English");
    option.click();

    await waitFor(() => expect(getByText("English")).toBeInTheDocument());
  });

  it("seeds and adds a language typed under Other", async () => {
    const { container, findByText } = await mount();
    await waitFor(() => expect(container.querySelector("textarea")).not.toBeNull());

    const dropdownButtons = [...container.querySelectorAll("button")];
    const addLanguageButton = dropdownButtons.find((b) =>
      /Adicionar l[ií]ngua/i.test(b.textContent),
    );
    addLanguageButton.click();

    const otherOption = await findByText("Outro");
    otherOption.click();

    // The one text input with this exact placeholder — reused from the
    // interface/learning-language "Other" flow, so it's unique in this form.
    const input = await waitFor(() => {
      const el = container.querySelector('input[placeholder="ex.: Inglês da Austrália"]');
      expect(el).not.toBeNull();
      return el;
    });

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(input, { target: { value: "Klingon" } });

    const addButton = await waitFor(() => {
      const btn = [...container.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Adicionar" && !b.disabled,
      );
      expect(btn).toBeDefined();
      return btn;
    });
    addButton.click();

    await waitFor(() => expect(seedLanguage).toHaveBeenCalledWith("Klingon", "Klingon", "tok"));
    await findByText("Klingon");
    expect(ctx.current.refreshSupportedLanguages).toHaveBeenCalled();
  });

  it("removes a language pill", async () => {
    const { container, queryByText } = await mount();
    await waitFor(() => expect(queryByText("Português")).toBeInTheDocument());

    const removeButtons = [...container.querySelectorAll('button[aria-label="Remover"]')];
    expect(removeButtons.length).toBeGreaterThan(0);
    removeButtons[0].click();

    await waitFor(() => expect(queryByText("Português")).toBeNull());
  });
});

describe("directory visibility", () => {
  const findPublishCheckbox = (container) =>
    [...container.querySelectorAll('input[type="checkbox"]')].find((box) =>
      /publicar/i.test(box.closest("label")?.textContent ?? ""),
    );

  it("offers a publish checkbox, checked while the profile is published", async () => {
    const { container } = await mount();

    await waitFor(() => expect(findPublishCheckbox(container)).toBeDefined());
    expect(findPublishCheckbox(container).checked).toBe(true);
  });

  it("shows it unchecked when the profile is hidden", async () => {
    getTutorProfile.mockResolvedValue({ ...SAVED_PROFILE, published: false });

    const { container } = await mount();

    await waitFor(() => expect(findPublishCheckbox(container)).toBeDefined());
    expect(findPublishCheckbox(container).checked).toBe(false);
  });

  it("hides the profile without deleting it when unchecked", async () => {
    const { container } = await mount();

    await waitFor(() => expect(findPublishCheckbox(container)).toBeDefined());
    findPublishCheckbox(container).click();

    // unpublishTutorProfile only flips `published`; the description and links
    // stay on the document so resubscribing restores them.
    await waitFor(() => expect(unpublishTutorProfile).toHaveBeenCalled());
    expect(saveTutorProfile).not.toHaveBeenCalled();
  });

  it("publishes when the checkbox is checked", async () => {
    getTutorProfile.mockResolvedValue({ ...SAVED_PROFILE, published: false });

    const { container } = await mount();

    await waitFor(() => expect(findPublishCheckbox(container)).toBeDefined());
    findPublishCheckbox(container).click();

    await waitFor(() => expect(saveTutorProfile).toHaveBeenCalled());
    expect(saveTutorProfile.mock.calls[0][0].published).toBe(true);
  });

  it("offers no visibility control before a profile has ever been saved", async () => {
    // No document at all: the whole editor is hidden, not just the checkbox.
    getTutorProfile.mockResolvedValue(null);

    const { container } = await mount();

    await waitFor(() => expect(getTutorProfile).toHaveBeenCalled());
    expect(findPublishCheckbox(container)).toBeUndefined();
  });
});

describe("arriving via #tutorSettings", () => {
  it("scrolls the card into view once its content has loaded", async () => {
    window.location.hash = "#tutorSettings";
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await mount({ id: "tutorSettings" });

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("does nothing when the hash points elsewhere", async () => {
    window.location.hash = "#somewhere-else";
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { container } = await mount({ id: "tutorSettings" });
    await waitFor(() => expect(container.querySelector("textarea")).not.toBeNull());

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
