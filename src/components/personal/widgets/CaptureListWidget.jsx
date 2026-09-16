import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import ConfirmModal from "../../ConfirmModal";
import PersonalWidgetCard from "../PersonalWidgetCard";
import QuickAddForm from "../QuickAddForm";
import { PERSONAL_PAGE_LIMIT } from "../../../services/personalService";

/**
 * CaptureListWidget
 *
 * The phrasebook and the mistake journal, which are the same widget with
 * different field names: a two-field quick-add and the newest few rows.
 *
 * **Add, don't manage.** Both lists have an optional third field — the
 * phrasebook's `note`, the journal's `why` — and `QuickAddForm`'s compact shape
 * drops it here. It is the reflective field you write sitting down, and asking
 * for it in a corridor is what stops someone capturing the thing at all. It is
 * still there on the full page.
 *
 * Delete is kept, behind the same `ConfirmModal` the pages use. It was tempting
 * to leave it out — a destructive control on a dashboard beside eight others is
 * a mis-tap magnet — but the confirm is exactly what makes a mis-tap harmless,
 * and a list you can only add to fills with typos.
 */
const CaptureListWidget = ({
  widgetId,
  fields,
  emptyKey,
  expandTo,
  items,
  atLimit,
  onAdd,
  onRemove,
  isDarkMode,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState(null);

  const [primary, secondary] = fields;

  // At the cap the real number is unknown, so "200" would quietly lie.
  const count = items.length === 0
    ? undefined
    : atLimit ? `${PERSONAL_PAGE_LIMIT}+` : String(items.length);

  const handleConfirmDelete = async () => {
    const id = pendingDelete;
    setPendingDelete(null);
    await onRemove(id);
  };

  return (
    <PersonalWidgetCard
      widgetId={widgetId}
      isDarkMode={isDarkMode}
      isLoading={isLoading}
      count={count}
      expandTo={expandTo}
    >
      {pendingDelete && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={t("personal.delete_title")}
          message={t("personal.delete_message")}
          confirmLabel={t("common.remove")}
          confirmColor="rose"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <div className="flex flex-col gap-3">
        <QuickAddForm fields={fields} onAdd={onAdd} isDarkMode={isDarkMode} compact />

        {items.length === 0 ? (
          <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t(emptyKey)}
          </p>
        ) : (
          // Capped and scrolled rather than sliced: a card that grows with
          // its content eventually owns the page, and `scrollbar-hidden` keeps
          // the neo surface clean. `overscroll-contain` stops a flick inside
          // the list from carrying on into the page behind it.
          <ul className="flex flex-col gap-1 max-h-52 sm:max-h-64 overflow-y-auto overscroll-contain scrollbar-hidden">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 py-1.5">
                  <p
                    className={`font-black tracking-tight break-words ${
                      isDarkMode ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {item[primary.name]}
                  </p>
                  {item[secondary.name] && (
                    <p
                      className={`text-sm font-semibold break-words ${
                        isDarkMode ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      {item[secondary.name]}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPendingDelete(item.id)}
                  aria-label={t("common.remove")}
                  className={`shrink-0 -mr-2 rounded-xl transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] ${
                    isDarkMode
                      ? "text-slate-500 hover:text-rose-400 hover:bg-slate-700"
                      : "text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                  }`}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PersonalWidgetCard>
  );
};

CaptureListWidget.propTypes = {
  widgetId: PropTypes.string.isRequired,
  /** Same shape PersonalListPage takes. The first two drive a row. */
  fields: PropTypes.array.isRequired,
  emptyKey: PropTypes.string.isRequired,
  expandTo: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  atLimit: PropTypes.bool,
  onAdd: PropTypes.func.isRequired,
  /** usePersonalCollection's `remove` — passed straight through, never wrapped. */
  onRemove: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default CaptureListWidget;
