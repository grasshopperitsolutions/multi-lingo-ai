import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";

/**
 * The mute button: its name says what pressing it will do, and pressing it
 * saves through AppContext (device and profile) as well as telling the sound
 * service at once, so the confirming chime is not played into a muted service.
 */

const setSoundPreference = vi.fn();
let sound = { muted: false, volume: 0.8, uiClicks: true };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({ sound, setSoundPreference }),
}));

const mount = async (props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: SoundToggle } = await import("../../src/components/SoundToggle");
  return render(
    <I18nextProvider i18n={i18n}>
      <SoundToggle isDarkMode={false} {...props} />
    </I18nextProvider>,
  );
};

beforeEach(() => {
  setSoundPreference.mockClear();
});

describe("SoundToggle", () => {
  it("offers to turn sound off when it is on, and saves the choice", async () => {
    sound = { muted: false, volume: 0.8, uiClicks: true };
    const sounds = await import("../../src/services/soundService");
    await mount();

    fireEvent.click(screen.getByRole("button", { name: "Desligar som" }));
    expect(setSoundPreference).toHaveBeenCalledWith({ muted: true });
    expect(sounds.getSoundPreferences().muted).toBe(true);
  });

  it("offers to turn sound on when muted", async () => {
    sound = { muted: true, volume: 0.8, uiClicks: true };
    const sounds = await import("../../src/services/soundService");
    await mount();

    fireEvent.click(screen.getByRole("button", { name: "Ligar som" }));
    expect(setSoundPreference).toHaveBeenCalledWith({ muted: false });
    expect(sounds.getSoundPreferences().muted).toBe(false);
  });

  it("closes the drawer after a toggle in the row variant", async () => {
    sound = { muted: false, volume: 0.8, uiClicks: true };
    const onAfterToggle = vi.fn();
    await mount({ variant: "row", onAfterToggle });

    fireEvent.click(screen.getByRole("button", { name: /Desligar som/ }));
    expect(onAfterToggle).toHaveBeenCalled();
  });
});
