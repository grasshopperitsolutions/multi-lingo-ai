import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Pencil, Plus, Eye, EyeOff } from "lucide-react";
import Loader from "../Loader";
import { GhostButton, PrimaryButton, SearchBar } from "../ui";

function matchesSearch(feature, term) {
  if (!term) return true;
  const haystack = [feature.label, feature.id, feature.labelKey, feature.hidden ? "hidden" : ""]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

/**
 * FeaturesSection — admin list of gateable features
 * (appConfig/config/features). Backed by featuresService.js.
 *
 * The key (document id) is what components gate on, so it is fixed once
 * created; `label` and `order` are presentational and edited freely here.
 * `labelKey` points at the translation key used for the user-facing name on
 * the dashboard and pricing page.
 *
 * The eye button toggles `hidden` in place, without opening the modal — that
 * flag is the one that gets flipped repeatedly while deciding what ships, so
 * it earns a one-click control. The same field is also on the edit form.
 */
const FeaturesSection = ({ features, isDarkMode, isLoadingDocs, error, onAddFeature, onEditFeature, onToggleHidden, togglingFeatureId }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(
    () => features.filter((f) => matchesSearch(f, searchTerm)),
    [features, searchTerm],
  );

  const mutedClasses = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PrimaryButton onClick={onAddFeature} isDarkMode={isDarkMode} color="emerald" className="!px-4 !py-2">
          <Plus size={16} />
          Add Feature
        </PrimaryButton>
      </div>

      {isLoadingDocs && <Loader message="Loading features..." isDarkMode={isDarkMode} />}

      {!isLoadingDocs && error && <p className="font-bold text-rose-500">{error}</p>}

      {!isLoadingDocs && !error && features.length === 0 && (
        <p className={`font-bold ${mutedClasses}`}>No features configured.</p>
      )}

      {!isLoadingDocs && !error && features.length > 0 && (
        <>
          <SearchBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search by label, key or translation key..."
            isDarkMode={isDarkMode}
          />
          <p className={`text-xs font-bold uppercase tracking-widest ${mutedClasses}`}>
            {filtered.length} of {features.length} feature{features.length === 1 ? "" : "s"}
          </p>
        </>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((feature) => (
          <div
            key={feature.id}
            className={`px-4 py-3 rounded-xl border-2 flex flex-wrap items-center gap-3 ${
              isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className={`shrink-0 w-10 text-xs font-black tabular-nums ${mutedClasses}`}>
              {feature.order}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`font-bold text-sm truncate ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                  {feature.label}
                </p>
                {feature.hidden && (
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${
                    isDarkMode ? "border-rose-700 text-rose-400" : "border-rose-300 text-rose-600"
                  }`}>
                    Hidden
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold truncate ${mutedClasses}`}>
                <code>{feature.id}</code>
                {feature.labelKey && <> &middot; {feature.labelKey}</>}
              </p>
            </div>
            <GhostButton
              onClick={() => onToggleHidden(feature)}
              isDarkMode={isDarkMode}
              disabled={togglingFeatureId === feature.id}
              className="!px-3 !py-1.5"
            >
              {feature.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              {feature.hidden ? "Show" : "Hide"}
            </GhostButton>
            <GhostButton onClick={() => onEditFeature(feature)} isDarkMode={isDarkMode} className="!px-3 !py-1.5">
              <Pencil size={14} /> Edit
            </GhostButton>
          </div>
        ))}
      </div>
    </div>
  );
};

FeaturesSection.propTypes = {
  features: PropTypes.array,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool,
  error: PropTypes.string,
  onAddFeature: PropTypes.func.isRequired,
  onEditFeature: PropTypes.func.isRequired,
  onToggleHidden: PropTypes.func.isRequired,
  togglingFeatureId: PropTypes.string,
};

FeaturesSection.defaultProps = {
  features: [],
  isLoadingDocs: false,
  error: null,
  togglingFeatureId: null,
};

export default FeaturesSection;
