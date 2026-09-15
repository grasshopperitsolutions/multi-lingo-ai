import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { usePersonalCollection } from "../../hooks/usePersonalCollection";
import ConfirmModal from "../ConfirmModal";
import Loader from "../Loader";
import { FeaturePageShell, Card, ErrorBanner } from "../ui";

/**
 * PersonalListPage
 *
 * The scaffold behind notes, the phrasebook, the mistake journal and the
 * lesson planner. All four are the same page with different fields: a compose
 * box, a list, an empty state, and a delete guarded by a confirm.
 *
 * Built mobile-first, because this is used standing in a corridor after a
 * lesson rather than at a desk:
 *
 *   - **The composer is above the list.** Adding never means scrolling past
 *     what you already wrote, which on a long mistake journal would bury the
 *     one control the page exists for.
 *   - Single column at every width. No master-detail, no sidebar.
 *   - Delete is a 44px target behind a ConfirmModal — a mis-tap on a phone
 *     must not destroy a note.
 *   - Inputs inherit 16px. Anything smaller makes iOS Safari zoom on focus and
 *     leave the viewport zoomed.
 *
 * `fields` drives everything: each entry becomes one input in the composer and
 * one line in a row. The first field is the one a row leads with.
 */
const PersonalListPage = ({
  kind,
  titleKey,
  fields,
  emptyKey,
  accentColor = "violet",
  reportContext,
  renderRow,
}) => {
  const { isDarkMode, showAlert } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { items, isLoading, error, atLimit, add, update, remove } = usePersonalCollection(kind);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.name, ""])),
  );
  const [pendingDelete, setPendingDelete] = useState(null);

  const isLocked = isReady && !canAccess("personal_tools");

  // Only a loaded config can lock the route — redirecting on the first render
  // would bounce every user out before their access is known.
  if (isLocked) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-semibold outline-none transition-colors ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-violet-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-violet-500"
  }`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  const required = fields.filter((field) => field.required !== false).map((field) => field.name);
  const canAdd = required.every((name) => draft[name]?.trim());

  const handleAdd = async () => {
    if (!canAdd) return;
    const data = Object.fromEntries(
      fields.map((field) => [field.name, (draft[field.name] ?? "").trim()]),
    );
    await add(data);
    setDraft(Object.fromEntries(fields.map((field) => [field.name, ""])));
    showAlert("success", t("personal.saved"));
  };

  const handleConfirmDelete = async () => {
    const id = pendingDelete;
    setPendingDelete(null);
    await remove(id);
  };

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor={accentColor}
      title={t(titleKey)}
      reportContext={reportContext}
      showFavourite={false}
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.personal_tools"), onClick: () => navigate("/dashboard/personal") },
        { label: t(titleKey) },
      ]}
    >
      {pendingDelete && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={t("personal.delete_title")}
          message={t("personal.delete_message")}
          confirmLabel={t("common.remove")}
          confirmColor="red"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Composer first — adding is the reason the page is open. */}
      <Card isDarkMode={isDarkMode}>
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className={labelClasses} htmlFor={`draft-${field.name}`}>
                {t(field.labelKey)}
              </label>
              {field.multiline ? (
                <textarea
                  id={`draft-${field.name}`}
                  value={draft[field.name]}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  rows={field.rows ?? 4}
                  placeholder={t(field.placeholderKey)}
                  className={`${inputClasses} resize-y`}
                />
              ) : (
                <input
                  id={`draft-${field.name}`}
                  type="text"
                  value={draft[field.name]}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  enterKeyHint="done"
                  placeholder={t(field.placeholderKey)}
                  className={inputClasses}
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 ${
              canAdd
                ? isDarkMode
                  ? "bg-yellow-400 border-yellow-400 text-slate-900"
                  : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                  : "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Plus size={18} />
            {t("personal.add")}
          </button>
        </div>
      </Card>

      {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {isLoading && <Loader message={t("common.loading")} isDarkMode={isDarkMode} />}

      {!isLoading && items.length === 0 && (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t(emptyKey)}
          </p>
        </Card>
      )}

      {!isLoading && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card isDarkMode={isDarkMode} key={item.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {renderRow
                    ? renderRow(item, { isDarkMode, update })
                    : fields.map((field, index) => (
                        <p
                          key={field.name}
                          className={
                            index === 0
                              ? `font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`
                              : `text-sm font-semibold mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`
                          }
                        >
                          {item[field.name]}
                        </p>
                      ))}
                </div>

                <button
                  type="button"
                  onClick={() => setPendingDelete(item.id)}
                  aria-label={t("common.remove")}
                  className={`shrink-0 p-3 rounded-xl transition-colors ${
                    isDarkMode
                      ? "text-slate-500 hover:text-rose-400 hover:bg-slate-700"
                      : "text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {atLimit && (
        <p className={`text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
          {t("personal.at_limit")}
        </p>
      )}
    </FeaturePageShell>
  );
};

PersonalListPage.propTypes = {
  /** One of PERSONAL_KINDS. */
  kind: PropTypes.string.isRequired,
  titleKey: PropTypes.string.isRequired,
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      labelKey: PropTypes.string.isRequired,
      placeholderKey: PropTypes.string.isRequired,
      multiline: PropTypes.bool,
      rows: PropTypes.number,
      /** Defaults to true; a field marked false can be left blank. */
      required: PropTypes.bool,
    }),
  ).isRequired,
  emptyKey: PropTypes.string.isRequired,
  accentColor: PropTypes.string,
  reportContext: PropTypes.string,
  /** Optional custom row body, for a list that is not just its fields. */
  renderRow: PropTypes.func,
};

export default PersonalListPage;
