import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The tutor directory page: own-listing-first, the become-a-tutor /
 * apply CTA, search and language filtering, and the trailing placeholder
 * that only shows on an unfiltered last page.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

const listTutors = vi.fn();
const getTutorProfile = vi.fn();
const createTutorDraft = vi.fn();

vi.mock("../../src/services/tutorService", async (importOriginal) => ({
  ...(await importOriginal()),
  listTutors: (...a) => listTutors(...a),
  getTutorProfile: (...a) => getTutorProfile(...a),
  createTutorDraft: (...a) => createTutorDraft(...a),
}));

const SUPPORTED_LANGUAGES = [
  { code: "pt-PT", label: "Português" },
  { code: "en-US", label: "English" },
];

const makeTutor = (overrides) => ({
  uid: "t-default",
  displayName: "Tutor",
  description: "",
  email: null,
  phone: null,
  whatsapp: false,
  languages: [],
  links: [],
  published: true,
  ...overrides,
});

const baseContext = (overrides = {}) =>
  makeAppContext({
    user: { uid: "me", displayName: "Nuno", subscriptionTier: "maestro" },
    tiersConfig: {
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: [],
      },
    },
    features: [],
    supportedLanguages: SUPPORTED_LANGUAGES,
    interfaceLanguageOptions: SUPPORTED_LANGUAGES,
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = baseContext();
  listTutors.mockResolvedValue([]);
  getTutorProfile.mockResolvedValue(null);
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

const mount = async () => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: TutorsPage } = await import("../../src/pages/dashboard/TutorsPage");

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <TutorsPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe("the viewer's own listing", () => {
  it("is pinned first and not duplicated in the public list", async () => {
    const mine = makeTutor({ uid: "me", displayName: "Nuno's profile", published: true });
    listTutors.mockResolvedValue([
      makeTutor({ uid: "other", displayName: "Someone Else" }),
      mine,
    ]);
    getTutorProfile.mockResolvedValue(mine);

    const { container, getByText } = await mount();

    await waitFor(() => expect(getByText("Nuno's profile")).toBeInTheDocument());

    // Appears once, not twice (own copy + the one already in the public list).
    expect(container.textContent.match(/Nuno's profile/g)).toHaveLength(1);

    const names = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(names[0]).toBe("Nuno's profile");
  });

  it("shows even when hidden, with the update-profile control", async () => {
    const mine = makeTutor({ uid: "me", displayName: "Draft", published: false });
    listTutors.mockResolvedValue([]); // hidden — never in the public list
    getTutorProfile.mockResolvedValue(mine);

    const { getByText } = await mount();

    await waitFor(() => expect(getByText("Draft")).toBeInTheDocument());
    expect(getByText("Atualizar o meu perfil")).toBeInTheDocument();
  });
});

describe("become a tutor", () => {
  it("offers to create a draft when eligible and not yet a tutor", async () => {
    listTutors.mockResolvedValue([]);
    getTutorProfile.mockResolvedValue(null);
    createTutorDraft.mockResolvedValue({ displayName: "Nuno", published: false });

    const { getByText } = await mount();

    const button = await waitFor(() => getByText("Tornar-me tutor"));
    button.click();

    await waitFor(() => expect(createTutorDraft).toHaveBeenCalled());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/settings#tutorSettings"));
  });

  it("is a small button, not a grid card", async () => {
    listTutors.mockResolvedValue([]);
    getTutorProfile.mockResolvedValue(null);

    const { getByText } = await mount();

    const button = await waitFor(() => getByText("Tornar-me tutor").closest("button"));
    // The old shape was a dashed placeholder card with its own heading and
    // hint paragraph above the button; none of that exists any more.
    expect(button).not.toBeNull();
    expect(button.closest(".border-dashed")).toBeNull();
  });

  it("offers to apply, without creating anything, when ineligible", async () => {
    ctx.current = baseContext({ user: { uid: "me", displayName: "Nuno", subscriptionTier: "explorer" } });
    listTutors.mockResolvedValue([]);
    getTutorProfile.mockResolvedValue(null);

    const { getByText } = await mount();

    const button = await waitFor(() => getByText("Candidata-te a tutor"));
    button.click();

    expect(createTutorDraft).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/settings#tutorSettings");
  });

  it("offers no become-a-tutor control once the viewer already has a profile", async () => {
    const mine = makeTutor({ uid: "me", displayName: "Nuno", published: true });
    listTutors.mockResolvedValue([mine]);
    getTutorProfile.mockResolvedValue(mine);

    const { queryByText, getByText } = await mount();

    await waitFor(() => expect(getByText("Nuno")).toBeInTheDocument());
    expect(queryByText("Tornar-me tutor")).toBeNull();
    expect(queryByText("Candidata-te a tutor")).toBeNull();
  });
});

describe("search and filtering", () => {
  const others = [
    makeTutor({ uid: "a", displayName: "Ana", description: "Conversational Portuguese", languages: ["pt-PT"] }),
    makeTutor({ uid: "b", displayName: "Ben", description: "Grammar-focused English", languages: ["en-US"] }),
  ];

  beforeEach(() => {
    listTutors.mockResolvedValue(others);
    getTutorProfile.mockResolvedValue(null);
  });

  it("filters by free text against name and description", async () => {
    const { getByPlaceholderText, getByText, queryByText } = await mount();

    await waitFor(() => expect(getByText("Ana")).toBeInTheDocument());

    const search = getByPlaceholderText("Procurar por nome ou descrição…");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(search, { target: { value: "grammar" } });

    await waitFor(() => expect(queryByText("Ana")).toBeNull());
    expect(getByText("Ben")).toBeInTheDocument();
  });

  it("hides the trailing placeholder while a filter is active", async () => {
    const { getByPlaceholderText, queryByText } = await mount();
    await waitFor(() => expect(queryByText("Mais tutores a caminho")).toBeInTheDocument());

    const search = getByPlaceholderText("Procurar por nome ou descrição…");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(search, { target: { value: "Ana" } });

    await waitFor(() => expect(queryByText("Mais tutores a caminho")).toBeNull());
  });

  it("shows a no-results message when nothing matches", async () => {
    const { getByPlaceholderText, getByText } = await mount();
    await waitFor(() => expect(getByText("Ana")).toBeInTheDocument());

    const search = getByPlaceholderText("Procurar por nome ou descrição…");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(search, { target: { value: "nobody teaches this" } });

    await waitFor(() => expect(getByText("Nenhum tutor encontrado.")).toBeInTheDocument());
  });
});

describe("pagination", () => {
  it("shows the trailing placeholder only on the last page", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeTutor({ uid: `t${i}`, displayName: `Tutor ${i}` }),
    );
    listTutors.mockResolvedValue(many);
    getTutorProfile.mockResolvedValue(null);

    const { queryByText } = await mount();

    // Page 1 of a 12-tutor, 9-per-page listing is not the last page.
    await waitFor(() => expect(queryByText("Tutor 0")).toBeInTheDocument());
    expect(queryByText("Mais tutores a caminho")).toBeNull();
  });
});
