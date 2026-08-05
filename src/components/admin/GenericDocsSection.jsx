import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import Loader from "../Loader";
import { GhostButton, SearchBar } from "../ui";

function matchesSearch(doc, i, term) {
  if (!term) return true;
  const haystack = `${doc.id ?? `#${i}`} ${JSON.stringify(doc)}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

/**
 * GenericDocsSection — collapsible JSON viewer/editor for any appConfig/config/*
 * collection without a dedicated editor (currently Languages and Writing
 * Systems). Filterable by a client-side text search over doc id + contents;
 * each entry expands to its full JSON and can be edited raw via
 * GenericDocEditModal (see onEditDoc).
 */
const GenericDocsSection = ({ docs, isDarkMode, isLoadingDocs, error, onEditDoc }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const filteredDocs = useMemo(
    () => docs.filter((d, i) => matchesSearch(d, i, searchTerm)),
    [docs, searchTerm]
  );

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {isLoadingDocs && <Loader message="Loading..." isDarkMode={isDarkMode} />}

      {!isLoadingDocs && error && <p className="font-bold text-rose-500">{error}</p>}

      {!isLoadingDocs && !error && docs.length > 0 && (
        <div className="flex flex-col gap-4 mb-4">
          <SearchBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search..."
            isDarkMode={isDarkMode}
          />
          <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {filteredDocs.length} of {docs.length} document{docs.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {!isLoadingDocs && !error && docs.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No documents in this section yet.
        </p>
      )}

      {!isLoadingDocs && !error && docs.length > 0 && filteredDocs.length === 0 && (
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          No documents match &quot;{searchTerm}&quot;.
        </p>
      )}

      {!isLoadingDocs && !error && filteredDocs.length > 0 && (
        <div className="flex flex-col gap-4">
          {filteredDocs.map((doc, i) => {
            const id = doc.id ?? `#${i}`;
            const isExpanded = expandedIds.has(id);
            return (
              <div
                key={id}
                className={`rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpanded(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpanded(id);
                    }
                  }}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown size={16} className={`shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                    ) : (
                      <ChevronRight size={16} className={`shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
                    )}
                    <span className={`font-black text-sm truncate ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                      {id}
                    </span>
                  </span>
                  <GhostButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDoc(doc);
                    }}
                    isDarkMode={isDarkMode}
                    className="!px-3 !py-2 shrink-0"
                  >
                    <Pencil size={14} />
                    Edit
                  </GhostButton>
                </div>
                {isExpanded && (
                  <pre className={`text-xs whitespace-pre-wrap break-words font-mono px-4 pb-4 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

GenericDocsSection.propTypes = {
  docs: PropTypes.array.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoadingDocs: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onEditDoc: PropTypes.func.isRequired,
};

export default GenericDocsSection;
