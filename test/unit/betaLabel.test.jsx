import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { isFeatureBeta } from "../../src/utils/featureAccess";

/**
 * The "Beta" label: set per feature in Admin › Features, shown on the
 * feature's tiles and pricing rows. A label, never a gate.
 */

const queryCollection = vi.fn();
const createDocument = vi.fn(async () => ({}));
vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  createDocument: (...a) => createDocument(...a),
  getTokenOrAnonymous: vi.fn(async () => "tok"),
}));

beforeEach(() => vi.clearAllMocks());

const withI18n = async (ui) => {
  const { default: i18n } = await import("../../src/i18n");
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
};

describe("isFeatureBeta", () => {
  const registry = [{ id: "voice_practice", beta: true }, { id: "translator" }];

  it("reads the flag from the registry", () => {
    expect(isFeatureBeta(registry, "voice_practice")).toBe(true);
    expect(isFeatureBeta(registry, "translator")).toBe(false);
    expect(isFeatureBeta(registry, "unknown")).toBe(false);
  });

  it("answers false before the registry has loaded", () => {
    // Also what a test faking useTierAccess without a registry gets.
    expect(isFeatureBeta(undefined, "voice_practice")).toBe(false);
    expect(isFeatureBeta(null, "voice_practice")).toBe(false);
  });
});

describe("featuresService", () => {
  it("reads beta, treating an absent flag as not beta", async () => {
    queryCollection.mockResolvedValueOnce({
      documents: [
        { id: "voice_practice", label: "Voice", order: 2, beta: true },
        { id: "translator", label: "Translator", order: 1 },
      ],
    });
    const { getFeatures } = await import("../../src/services/featuresService");
    const features = await getFeatures("tok");

    expect(features.find((f) => f.id === "voice_practice").beta).toBe(true);
    expect(features.find((f) => f.id === "translator").beta).toBe(false);
  });

  it("writes beta with the rest of the feature", async () => {
    const { saveFeature } = await import("../../src/services/featuresService");
    await saveFeature("voice_practice", { label: "Voice", order: 2, hidden: false, beta: true });

    const [, data, id] = createDocument.mock.calls[0];
    expect(id).toBe("voice_practice");
    expect(data).toMatchObject({ label: "Voice", hidden: false, beta: true });
  });
});

describe("FeatureCard", () => {
  it("shows the label only on a beta feature", async () => {
    const { default: FeatureCard } = await import("../../src/components/FeatureCard");
    const Icon = () => <svg />;

    const { rerender } = await withI18n(
      <FeatureCard icon={Icon} title="Voice" color="text-sky-500" isDarkMode={false} isBeta />,
    );
    expect(screen.getByText("Beta")).toBeTruthy();

    const { default: i18n } = await import("../../src/i18n");
    const { I18nextProvider: Provider } = await import("react-i18next");
    rerender(
      <Provider i18n={i18n}>
        <FeatureCard icon={Icon} title="Voice" color="text-sky-500" isDarkMode={false} />
      </Provider>,
    );
    expect(screen.queryByText("Beta")).toBeNull();
  });
});

describe("Admin › Features", () => {
  it("labels beta features and toggles the flag in one click", async () => {
    const { default: FeaturesSection } = await import("../../src/components/admin/FeaturesSection");
    const onToggleBeta = vi.fn();
    const feature = { id: "voice_practice", label: "Voice practice", labelKey: "", order: 2, hidden: false, beta: true };

    render(
      <FeaturesSection
        features={[feature]}
        isDarkMode={false}
        onAddFeature={vi.fn()}
        onEditFeature={vi.fn()}
        onToggleHidden={vi.fn()}
        onToggleBeta={onToggleBeta}
      />,
    );

    expect(screen.getByText("Beta")).toBeTruthy();
    fireEvent.click(screen.getByText("Not beta"));
    expect(onToggleBeta).toHaveBeenCalledWith(feature);
  });
});
