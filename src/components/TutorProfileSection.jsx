import { useEffect, useState } from "react";
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
} from "lucide-react";
import { auth } from "../firebase";
import { useTierAccess } from "../hooks/useTierAccess";
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

const TutorProfileSection = ({ isDarkMode, user, sectionClasses }) => {
  const { t } = useTranslation();
  const { tier, isReady } = useTierAccess();

  const [profile, setProfile] = useState(null);
  const [links, setLinks] = useState([emptyLink()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validatingIndex, setValidatingIndex] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

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
          setLinks(existing.links?.length ? existing.links : [emptyLink()]);
        } else {
          setProfile({ description: "" });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [eligible, user?.uid, user?.displayName]);

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

  const filledLinks = links.filter((link) => link.url?.trim() || link.label?.trim());
  const allLinksValid = filledLinks.every(isLinkValidated);
  const hasRequired = Boolean(user?.displayName?.trim() && profile?.description?.trim());
  const canSave = hasRequired && allLinksValid && !isSaving;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveTutorProfile({ ...profile, links: filledLinks });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setIsSaving(true);
    try {
      await unpublishTutorProfile();
      setProfile((p) => ({ ...p, published: false }));
    } catch (err) {
      setError(err.message);
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

  if (!isReady || isLoading) return null;

  // Not eligible: offer the way in rather than a locked door.
  if (!eligible) {
    return <TutorApplicationForm isDarkMode={isDarkMode} sectionClasses={sectionClasses} />;
  }

  return (
    <div className={sectionClasses}>
      <h2 className={`text-lg font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        <UserRound size={16} className="inline mr-2" />
        {t("tutors.edit_title")}
      </h2>
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

        <div>
          <span className={labelClasses}>{t("tutors.photo")}</span>
          <input
            type="url"
            value={profile?.photoURL ?? ""}
            placeholder={user?.photoURL ?? ""}
            onChange={(e) => { setProfile({ ...profile, photoURL: e.target.value }); setSaved(false); }}
            className={inputClasses}
          />
          <p className={hintClasses}>{t("tutors.photo_hint")}</p>
        </div>

        {/* Contact. The email is the account's and is not editable here —
            changing where a tutor is reachable should mean changing the
            account, not keeping a second address that can silently rot. */}
        <div>
          <span className={labelClasses}>{t("tutors.email")}</span>
          <input type="email" value={user?.email ?? ""} disabled className={`${inputClasses} opacity-60`} />
        </div>

        <div>
          <span className={labelClasses}>{t("tutors.phone")}</span>
          <input
            type="tel"
            value={profile?.phone ?? ""}
            onChange={(e) => { setProfile({ ...profile, phone: e.target.value }); setSaved(false); }}
            className={inputClasses}
          />
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

        {profile?.published !== false && profile?.createdAt && (
          <button
            type="button"
            onClick={handleUnpublish}
            disabled={isSaving}
            className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
              ${isDarkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-900 text-slate-900"}`}
          >
            {t("tutors.unpublish")}
          </button>
        )}
      </div>
    </div>
  );
};

TutorProfileSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  user: PropTypes.object,
  sectionClasses: PropTypes.string.isRequired,
};

export default TutorProfileSection;
