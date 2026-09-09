import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
  Check,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { auth } from "../firebase";
import { useAppContext } from "../contexts/AppContext";
import { SettingsSection } from "./ui";
import LanguageFlagIcon from "./LanguageFlagIcon";
import NeoDropdown from "./NeoDropdown";
import { dialCodeOptions, joinPhone, splitPhone } from "../config/dialCodes";
import { useTierAccess } from "../hooks/useTierAccess";
import { seedLanguage } from "../services/supportedLanguagesService";
import { normalizeCode } from "../utils/languageCode";
import {
  canBeTutor,
  getTutorProfile,
  saveTutorProfile,
  unpublishTutorProfile,
} from "../services/tutorService";
import {
  isLinkValidated,
  linkValidation,
  validateUrlWithAi,
} from "../services/tutorUrlValidation";
import TutorApplicationForm from "./TutorApplicationForm";

/**
 * Editor for the signed-in user's public tutor profile.
 *
 * Renders for `maestro`/`vip`/`admin` only; every other tier is offered the
 * application form instead. That check is a UI convenience — the real gate is
 * the `writeTiers` on the `tutors` collection policy in the API, which reads
 * `subscriptionTier` server-side from a field users cannot set themselves.
 *
 * A second gate sits in front of the editor itself, independent of tier:
 * nothing renders here at all until a tutor document already exists. There is
 * deliberately no "start filling this in and we'll create it on Save" path —
 * `createTutorDraft()` (tutorService.js), called from the "Become a tutor"
 * button on the tutor directory page, is the only way a document comes into
 * being, always hidden (`published: false`), before this editor ever shows
 * it. A user who has never clicked that button sees no card here at all.
 *
 * The save button stays disabled until every link is validated. Validation is
 * free for a recognised host and costs one AI call otherwise, which is why
 * the AI route is behind an explicit button rather than firing on blur.
 */

const emptyLink = () => ({
  url: "",
  label: "",
  platform: null,
  validatedBy: null,
  validatedAt: null,
  validatedUrl: null,
});

const TutorProfileSection = ({ isDarkMode, user, defaultOpen = false, id = undefined }) => {
  const { t, i18n } = useTranslation();
  const { tier, isReady } = useTierAccess();
  const { supportedLanguages, refreshSupportedLanguages } = useAppContext();

  // Country names come from Intl.DisplayNames in the interface language, so
  // the picker reads correctly even in languages this app has no translation
  // for. Recomputed only when that language changes — it builds ~240 names
  // and sorts them through a collator.
  const { suggested, rest } = useMemo(
    () => dialCodeOptions(i18n.language),
    [i18n.language],
  );

  const [profile, setProfile] = useState(null);
  const [links, setLinks] = useState([emptyLink()]);
  const [languages, setLanguages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validatingIndex, setValidatingIndex] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // The country half of the phone field. The number itself stays on `profile`
  // as one E.164 string, because that is what the public card renders and what
  // a `tel:` link needs — this is only the picker's half of it.
  const [dialIso, setDialIso] = useState(splitPhone(null).iso);

  // "Languages you speak" — a NeoDropdown "add" control with the same
  // known-list-plus-Other shape as the interface/learning-language pickers in
  // Settings, but adding to a list rather than replacing a single value.
  const [showOtherLanguage, setShowOtherLanguage] = useState(false);
  const [otherLanguageText, setOtherLanguageText] = useState("");
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);

  const eligible = canBeTutor(tier);

  useEffect(() => {
    if (!eligible || !user?.uid) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const existing = await getTutorProfile(user.uid);
        if (existing) {
          setProfile(existing);
          setDialIso(splitPhone(existing.phone).iso);
          setLinks(existing.links?.length ? existing.links : [emptyLink()]);
          setLanguages(Array.isArray(existing.languages) ? existing.languages : []);
        } else {
          // No document at all — the editor stays hidden (see the header
          // comment). Reset rather than leave stale state from a previous
          // session's profile.
          setProfile(null);
          setLinks([emptyLink()]);
          setLanguages([]);
          setDialIso(splitPhone(null).iso);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [eligible, user?.uid, user?.displayName]);

  // Scrolls this card into view when arrived at via /settings#tutorSettings
  // (the "Update my profile" button on a tutor's own directory card). Waits
  // for the profile fetch to settle first — before that, the element with
  // this id may not exist yet (nothing renders while isLoading, and nothing
  // renders at all if there turns out to be no profile).
  useEffect(() => {
    if (isLoading || !id) return;
    if (typeof window === "undefined" || window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isLoading, id]);

  const updateLink = (index, patch) => {
    setLinks((current) =>
      current.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    );
    setSaved(false);
  };

  const handleValidateWithAi = async (index) => {
    const url = links[index].url?.trim();
    if (!url) return;

    setValidatingIndex(index);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const verdict = await validateUrlWithAi(token, url);

      if (verdict.ok) {
        updateLink(index, {
          platform: verdict.platform,
          validatedBy: verdict.validatedBy,
          validatedAt: verdict.validatedAt,
          // Pins the verdict to this exact URL, so editing it afterwards
          // drops the tick instead of carrying the approval elsewhere.
          validatedUrl: url,
          reason: null,
        });
      } else {
        updateLink(index, { validatedAt: null, validatedUrl: null, reason: verdict.reason });
      }
    } finally {
      setValidatingIndex(null);
    }
  };

  // ── Languages you speak ────────────────────────────────────────────────
  const languageOptions = (supportedLanguages ?? []).filter(
    (l) => !languages.some((code) => normalizeCode(code) === normalizeCode(l.code)),
  );

  const addLanguage = (code) => {
    setLanguages((current) =>
      current.some((c) => normalizeCode(c) === normalizeCode(code)) ? current : [...current, code],
    );
    setSaved(false);
  };

  const removeLanguage = (code) => {
    setLanguages((current) => current.filter((c) => c !== code));
    setSaved(false);
  };

  const handleAddOtherLanguage = async () => {
    const typed = otherLanguageText.trim();
    if (!typed) return;

    setIsAddingLanguage(true);
    setError(null);
    try {
      const known = supportedLanguages?.find(
        (l) => normalizeCode(l.code) === normalizeCode(typed),
      );
      let code = known?.code;
      if (!code) {
        const token = await auth.currentUser.getIdToken();
        const created = await seedLanguage(typed, typed, token);
        code = created?.id ?? typed;
        await refreshSupportedLanguages();
      }
      addLanguage(code);
      setOtherLanguageText("");
      setShowOtherLanguage(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAddingLanguage(false);
    }
  };

  const languageLabel = (code) => {
    const known = supportedLanguages?.find((l) => l.code === code);
    return known?.label || code;
  };

  const filledLinks = links.filter((link) => link.url?.trim() || link.label?.trim());
  const allLinksValid = filledLinks.every(isLinkValidated);
  const hasRequired = Boolean(user?.displayName?.trim() && profile?.description?.trim());
  const canSave = hasRequired && allLinksValid && !isSaving;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveTutorProfile({ ...profile, links: filledLinks, languages });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Publish or unpublish the profile in the directory.
   *
   * A checkbox rather than a "remove from directory" button, because that is
   * what this control actually does: the document is never deleted, only
   * flipped between visible and not — the same flag the Stripe webhook sets
   * when a subscription lapses, so a profile that comes back brings its
   * description and links with it.
   *
   * Applied immediately rather than on Save, so the answer to "am I listed?"
   * is never waiting on a form submit.
   */
  const handleTogglePublished = async (nextPublished) => {
    const previous = profile?.published !== false;
    setProfile((p) => ({ ...p, published: nextPublished }));
    setIsSaving(true);
    setError(null);
    try {
      if (nextPublished) {
        await saveTutorProfile({ ...profile, published: true, links: filledLinks, languages });
      } else {
        await unpublishTutorProfile();
      }
    } catch (err) {
      setError(err.message);
      // Put the switch back: leaving it showing a state the server rejected
      // is worse than the failure itself.
      setProfile((p) => ({ ...p, published: previous }));
    } finally {
      setIsSaving(false);
    }
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${isDarkMode
      ? "bg-slate-900 border-slate-700 text-white focus:border-yellow-400 placeholder-slate-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-blue-600 placeholder-slate-400"}`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  const hintClasses = `mt-1 text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`;

  const pillClasses = `inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border-2 text-xs font-black uppercase tracking-widest
    ${isDarkMode ? "border-slate-600 text-slate-200 bg-slate-900/40" : "border-slate-300 text-slate-700 bg-slate-50"}`;

  if (!isReady || isLoading) return null;

  // Not eligible: offer the way in rather than a locked door.
  if (!eligible) {
    return <TutorApplicationForm isDarkMode={isDarkMode} defaultOpen={defaultOpen} id={id} />;
  }

  // Eligible, but no document exists yet: hidden. "Become a tutor" on the
  // directory page (TutorsPage) is what creates one — see the file header.
  if (!profile) return null;

  return (
    <SettingsSection
      id={id}
      title={t("tutors.edit_title")}
      icon={<UserRound size={16} className="inline mr-2" />}
      isDarkMode={isDarkMode}
      defaultOpen={defaultOpen}
    >
      <p className={`text-sm font-bold mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("tutors.edit_intro")}
      </p>

      <div className="space-y-5">
        {/* Read-only, like the email below it. A tutor is a user, so there is
            one name — editing it here would create a second identity to keep
            in step. Changing it means changing the account display name in the
            Profile section above, which syncTutorDisplayName() mirrors across. */}
        <div>
          <span className={labelClasses}>{t("tutors.display_name")}</span>
          <input
            type="text"
            value={user?.displayName ?? ""}
            disabled
            className={`${inputClasses} opacity-60`}
          />
          <p className={hintClasses}>{t("tutors.display_name_hint")}</p>
        </div>

        <div>
          <span className={labelClasses}>{t("tutors.description")}</span>
          <textarea
            rows={4}
            value={profile?.description ?? ""}
            onChange={(e) => { setProfile({ ...profile, description: e.target.value }); setSaved(false); }}
            className={inputClasses}
          />
          <p className={hintClasses}>{t("tutors.description_hint")}</p>
        </div>

        {/* No photo field. It was a URL box whose placeholder — not value —
            was the account picture, so leaving it alone saved photoURL: null
            and the directory card rendered no image at all. The picture now
            comes from the account, like the name and the email: one identity,
            one place to change it. */}
        {/* Contact. The email is the account's and is not editable here —
            changing where a tutor is reachable should mean changing the
            account, not keeping a second address that can silently rot. */}
        <div>
          <span className={labelClasses}>{t("tutors.email")}</span>
          <input type="email" value={user?.email ?? ""} disabled className={`${inputClasses} opacity-60`} />
        </div>

        {/* Languages spoken — same known-list-plus-Other shape as the
            interface/learning-language pickers, but adding to a list rather
            than replacing a single value. Not required: a tutor's spoken
            languages are useful for the directory's language filter, but
            withholding them should not block publishing. */}
        <div>
          <span className={labelClasses}>{t("tutors.languages_speak")}</span>
          <p className={hintClasses}>{t("tutors.languages_speak_hint")}</p>

          {languages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 mb-3">
              {languages.map((code) => (
                <span key={code} className={pillClasses}>
                  <LanguageFlagIcon code={code} />
                  {languageLabel(code)}
                  <button
                    type="button"
                    onClick={() => removeLanguage(code)}
                    aria-label={t("common.remove")}
                    className="hover:opacity-70"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-start gap-3 mt-2">
            {/*
              NeoDropdown always resolves `value` to a concrete option's label
              for its resting button text — pass no matching value and, with
              showOtherOption set, it reads as "Other" before anything is
              picked. A real placeholder option (value: "") as the first
              entry gives the button its own resting label instead; selecting
              it is a no-op.
            */}
            <NeoDropdown
              options={[
                { value: "", label: t("tutors.languages_add_placeholder") },
                ...languageOptions.map((l) => ({
                  value: l.code,
                  flagCode: l.code,
                  label: l.label || l.code,
                })),
              ]}
              value=""
              onChange={(val) => { if (val) addLanguage(val); }}
              showOtherOption
              otherLabel={t("onboarding.other_option")}
              onOtherSelect={() => setShowOtherLanguage(true)}
              isDarkMode={isDarkMode}
            />
          </div>

          {showOtherLanguage && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <input
                type="text"
                value={otherLanguageText}
                onChange={(e) => setOtherLanguageText(e.target.value)}
                placeholder={t("onboarding.learning_placeholder")}
                className={`${inputClasses} w-auto flex-1 min-w-[10rem]`}
              />
              <button
                type="button"
                onClick={handleAddOtherLanguage}
                disabled={isAddingLanguage || !otherLanguageText.trim()}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95
                  ${isDarkMode ? "border-yellow-400 text-yellow-400" : "border-blue-600 text-blue-600"}`}
              >
                {isAddingLanguage
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Plus size={14} />}
                {t("common.add")}
              </button>
            </div>
          )}
        </div>

        <div>
          <span className={labelClasses}>{t("tutors.phone")}</span>

          {/* Split control, single stored value. The card shows one E.164
              string and `tel:` needs one, but a tutor typing a local number
              without their country code publishes something only their
              neighbours can dial. */}
          <div className="flex gap-3">
            <select
              value={dialIso}
              aria-label={t("tutors.phone_country")}
              onChange={(e) => {
                const iso = e.target.value;
                setDialIso(iso);
                setProfile({ ...profile, phone: joinPhone(iso, splitPhone(profile?.phone).national) });
                setSaved(false);
              }}
              className={`${inputClasses} w-auto shrink-0`}
            >
              <optgroup label={t("tutors.phone_country_suggested")}>
                {suggested.map((country) => (
                  <option key={`s-${country.iso}`} value={country.iso}>
                    {country.name} ({country.dial})
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("tutors.phone_country_all")}>
                {rest.map((country) => (
                  <option key={country.iso} value={country.iso}>
                    {country.name} ({country.dial})
                  </option>
                ))}
              </optgroup>
            </select>

            <input
              type="tel"
              inputMode="tel"
              value={splitPhone(profile?.phone).national}
              placeholder={t("tutors.phone_placeholder")}
              onChange={(e) => {
                setProfile({ ...profile, phone: joinPhone(dialIso, e.target.value) });
                setSaved(false);
              }}
              className={inputClasses}
            />
          </div>
          <p className={hintClasses}>{t("tutors.phone_hint")}</p>

          {/* Only offered once there is a number for it to describe. */}
          {profile?.phone?.trim() && (
            <label className="flex items-center gap-3 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profile?.whatsapp)}
                onChange={(e) => { setProfile({ ...profile, whatsapp: e.target.checked }); setSaved(false); }}
                className="w-5 h-5"
              />
              <span className={`text-sm font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                {t("tutors.whatsapp_hint")}
              </span>
            </label>
          )}
        </div>

        {/* Links */}
        <div>
          <span className={labelClasses}>{t("tutors.links")}</span>

          <div className="space-y-4">
            {links.map((link, index) => {
              // Derived every render rather than read from state: a
              // recognised host is a pure function of the URL.
              const state = linkValidation(link);
              const validated = state?.ok === true;
              const needsAi = state?.needsAi === true;

              return (
                <div
                  key={index}
                  className={`p-4 rounded-2xl border-2 space-y-3
                    ${isDarkMode ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-slate-50"}`}
                >
                  <input
                    type="url"
                    value={link.url}
                    placeholder="https://"
                    onChange={(e) => updateLink(index, { url: e.target.value, reason: null })}
                    className={inputClasses}
                  />
                  <input
                    type="text"
                    value={link.label}
                    placeholder={t("tutors.link_label_placeholder")}
                    onChange={(e) => updateLink(index, { label: e.target.value })}
                    className={inputClasses}
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    {validated ? (
                      <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-black uppercase tracking-widest
                        ${isDarkMode ? "bg-emerald-950 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>
                        <Check size={14} strokeWidth={4} />
                        {state.platform ?? t("tutors.validated")}
                      </span>
                    ) : needsAi ? (
                      <button
                        type="button"
                        onClick={() => handleValidateWithAi(index)}
                        disabled={validatingIndex !== null}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95
                          ${isDarkMode ? "border-yellow-400 text-yellow-400" : "border-blue-600 text-blue-600"}`}
                      >
                        {validatingIndex === index
                          ? <Loader2 size={14} className="animate-spin" />
                          : <ShieldCheck size={14} />}
                        {validatingIndex === index ? t("tutors.validating") : t("tutors.validate")}
                      </button>
                    ) : (
                      <span className={`text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                        {t("tutors.needs_validation")}
                      </span>
                    )}

                    {link.url?.trim() && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => { setLinks(links.filter((_, i) => i !== index)); setSaved(false); }}
                      className={`ml-auto inline-flex items-center gap-2 text-xs font-bold ${isDarkMode ? "text-rose-400" : "text-rose-600"}`}
                    >
                      <Trash2 size={14} />
                      {t("tutors.remove_link")}
                    </button>
                  </div>

                  {(state?.errorKey || link.reason) && (
                    <p className="text-xs font-bold text-rose-500">
                      {state?.errorKey
                        ? t(state.errorKey)
                        : t("tutors.url_error_rejected", { reason: link.reason })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setLinks([...links, emptyLink()])}
            className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 text-xs font-black uppercase tracking-widest
              ${isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}
          >
            <Plus size={14} />
            {t("tutors.add_link")}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-bold text-rose-500">{error}</p>}
      {saved && (
        <p className={`mt-4 text-sm font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
          {t("tutors.saved")}
        </p>
      )}
      {!hasRequired && (
        <p className={`mt-4 text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {t("tutors.required_missing")}
        </p>
      )}
      {hasRequired && !allLinksValid && (
        <p className={`mt-4 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-700"}`}>
          {t("tutors.save_blocked")}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
            ${!canSave
              ? "opacity-40 cursor-not-allowed border-slate-400 text-slate-400"
              : isDarkMode
                ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_#854d0e]"
                : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {isSaving ? t("tutors.saving") : t("tutors.save")}
        </button>
      </div>

      {/* Visibility. Checked = published, which is the field itself, so no
          double negative to reason through. A freshly created draft ("Become
          a tutor") starts unchecked — published: false is written at
          creation — so nobody is listed with an empty description before
          they mean to be. */}
      <label className="mt-6 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={profile?.published !== false}
          disabled={isSaving}
          onChange={(e) => handleTogglePublished(e.target.checked)}
          className="w-5 h-5 mt-0.5 shrink-0"
        />
        <span>
          <span className={`block text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
            {t("tutors.publish_profile")}
          </span>
          <span className={hintClasses}>{t("tutors.publish_profile_hint")}</span>
        </span>
      </label>
    </SettingsSection>
  );
};

TutorProfileSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  user: PropTypes.object,
  /** Whether the card starts expanded. Defaults closed: this is the longest
   *  card on the page and the least often edited. */
  defaultOpen: PropTypes.bool,
  /** Forwarded to the wrapping SettingsSection (or the application form's) so
   *  /settings#tutorSettings can scroll straight to whichever one renders. */
  id: PropTypes.string,
};

export default TutorProfileSection;
