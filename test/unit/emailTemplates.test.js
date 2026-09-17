import { describe, it, expect } from "vitest";
import ptTranslation from "../../src/locales/pt/translation.json";

/**
 * emailTemplateService — the read-only view of the email and push-reminder
 * copy, and the list of what it shows.
 *
 * These strings exist in two repos that cannot import each other, so the
 * failure mode is drift: a template added to the base file and forgotten in
 * TEMPLATE_GROUPS is copy that ships without ever being visible, and a
 * {{variable}} hint that has gone stale is a literal "{{tier}}" in a real
 * email. Neither is something a type checker or a linter can see.
 *
 * The cross-repo half of this is in scripts/check-email-copy.mjs, which needs
 * the network and so lives in CI rather than here.
 */

/** Every leaf under `email` in the bundled base file, as dotted paths. */
function bundledEmailKeys(node = ptTranslation.email, prefix = "email") {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? bundledEmailKeys(value, `${prefix}.${key}`)
      : [`${prefix}.${key}`]
  );
}

describe("what is editable", () => {
  it("covers every email and reminder string in the bundle", async () => {
    const { TEMPLATE_GROUPS } = await import("../../src/services/emailTemplateService");
    const editable = new Set(TEMPLATE_GROUPS.flatMap((g) => g.keys));

    // A template added to the base file but not to TEMPLATE_GROUPS is copy
    // that goes out to real people and cannot be corrected without a deploy —
    // which is the whole reason this editor exists.
    expect(bundledEmailKeys().filter((k) => !editable.has(k))).toEqual([]);
  });

  it("offers no field that the bundle has no string for", async () => {
    const { TEMPLATE_GROUPS, bundledTemplateValue } =
      await import("../../src/services/emailTemplateService");

    // account_deleted.cta is deliberately "" — that email has no button — so
    // presence is checked against the file, not against truthiness.
    const bundled = bundledEmailKeys();
    for (const group of TEMPLATE_GROUPS) {
      for (const key of group.keys) {
        expect(bundled, `${key} is not in the bundle`).toContain(key);
        expect(typeof bundledTemplateValue(key)).toBe("string");
      }
    }
  });

  it("includes the four push reminders", async () => {
    const { TEMPLATE_GROUPS } = await import("../../src/services/emailTemplateService");
    const reminders = TEMPLATE_GROUPS.find((g) => g.id === "reminders");

    expect(reminders).toBeTruthy();
    for (const id of ["streak_rescue", "lessons_low", "weekly_review", "practice_nudge"]) {
      expect(reminders.keys).toContain(`email.reminders.${id}_subject`);
      expect(reminders.keys).toContain(`email.reminders.${id}_body`);
    }
  });
});

describe("the {{variable}} hints", () => {
  it("names every placeholder the shipped string actually interpolates", async () => {
    const { TEMPLATE_GROUPS, TEMPLATE_VARIABLES, bundledTemplateValue } =
      await import("../../src/services/emailTemplateService");

    // Dropping a placeholder renders a literal "{{days}}" in a real
    // notification, so the hint has to be complete, not decorative.
    for (const group of TEMPLATE_GROUPS) {
      for (const key of group.keys) {
        const present = [...bundledTemplateValue(key).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
        expect(new Set(TEMPLATE_VARIABLES[key] ?? []), key).toEqual(new Set(present));
      }
    }
  });
});

describe("the values shown", () => {
  it("are the bundled strings, with no request made", async () => {
    const { loadEmailTemplates } = await import("../../src/services/emailTemplateService");

    // Synchronous on purpose: the base file is the whole answer, so there is
    // nothing to await and nothing to fail. The pt-PT locale document this
    // used to read has been deleted.
    const values = loadEmailTemplates();
    expect(values["email.welcome.subject"]).toBe(ptTranslation.email.welcome.subject);
    expect(values["email.reminders.streak_rescue_body"]).toBe(
      ptTranslation.email.reminders.streak_rescue_body
    );
  });

  it("keep an intentionally empty string empty", async () => {
    const { loadEmailTemplates } = await import("../../src/services/emailTemplateService");

    // account_deleted has no button. Absence and emptiness are different
    // things here, and the panel says so rather than showing a blank box.
    expect(loadEmailTemplates()["email.account_deleted.cta"]).toBe("");
  });

  it("expose no way to write them", async () => {
    const service = await import("../../src/services/emailTemplateService");

    // Saving wrote to a document nothing read. If a save path comes back,
    // it needs a reader first — see the module comment.
    expect(service.saveEmailTemplates).toBeUndefined();
  });
});
