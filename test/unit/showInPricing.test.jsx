import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * "Show on the pricing page": set per feature in Admin › Features. Unticked,
 * the feature stays in the app but is left off the plan cards. Absent means
 * shown, so every feature that predates the field keeps its pricing row.
 */

const queryCollection = vi.fn();
const createDocument = vi.fn(async () => ({}));
vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  createDocument: (...a) => createDocument(...a),
  getTokenOrAnonymous: vi.fn(async () => "tok"),
}));

beforeEach(() => vi.clearAllMocks());

describe("featuresService", () => {
  it("reads the flag, treating an absent one as shown", async () => {
    queryCollection.mockResolvedValueOnce({
      documents: [
        { id: "grammar", label: "Grammar", order: 1, showInPricing: false },
        { id: "translator", label: "Translator", order: 2 },
      ],
    });
    const { getFeatures } = await import("../../src/services/featuresService");
    const features = await getFeatures("tok");

    expect(features.find((f) => f.id === "grammar").showInPricing).toBe(false);
    expect(features.find((f) => f.id === "translator").showInPricing).toBe(true);
  });

  it("writes the flag with the rest of the feature, shown unless told otherwise", async () => {
    const { saveFeature } = await import("../../src/services/featuresService");

    await saveFeature("grammar", { label: "Grammar", showInPricing: false });
    await saveFeature("translator", { label: "Translator" });

    expect(createDocument.mock.calls[0][1]).toMatchObject({ label: "Grammar", showInPricing: false });
    // A save path that knows nothing of the field must not take a feature
    // off the pricing page by leaving it out.
    expect(createDocument.mock.calls[1][1]).toMatchObject({ label: "Translator", showInPricing: true });
  });
});

describe("Admin › Features", () => {
  const feature = { id: "grammar", label: "Grammar", labelKey: "", order: 1, hidden: false, beta: false };

  it("edits the flag on the feature form, ticked by default", async () => {
    const { default: FeatureEditModal } = await import("../../src/components/admin/FeatureEditModal");
    const onSave = vi.fn();
    render(<FeatureEditModal feature={feature} isDarkMode={false} onSave={onSave} onClose={vi.fn()} />);

    const box = screen.getByLabelText("Show on the pricing page");
    expect(box.checked).toBe(true);

    fireEvent.click(box);
    fireEvent.click(screen.getByText("Save Feature"));
    fireEvent.click(screen.getByText("Yes, save"));

    expect(onSave).toHaveBeenCalledWith("grammar", expect.objectContaining({ showInPricing: false }), false);
  });

  it("marks a feature left off the pricing page in the list", async () => {
    const { default: FeaturesSection } = await import("../../src/components/admin/FeaturesSection");
    const props = {
      isDarkMode: false,
      onAddFeature: vi.fn(),
      onEditFeature: vi.fn(),
      onToggleHidden: vi.fn(),
      onToggleBeta: vi.fn(),
    };

    const { rerender } = render(<FeaturesSection features={[{ ...feature, showInPricing: false }]} {...props} />);
    expect(screen.getByText("Not on pricing")).toBeTruthy();

    // Hidden already keeps it off the pricing page; a second chip says nothing new.
    rerender(<FeaturesSection features={[{ ...feature, showInPricing: false, hidden: true }]} {...props} />);
    expect(screen.queryByText("Not on pricing")).toBeNull();

    rerender(<FeaturesSection features={[{ ...feature, showInPricing: true }]} {...props} />);
    expect(screen.queryByText("Not on pricing")).toBeNull();
  });
});
