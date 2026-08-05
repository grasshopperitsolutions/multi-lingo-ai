import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Loader from "../Loader";
import { SearchBar } from "../ui";

function matchesSearch(doc, i, term) {
  if (!term) return true;
  const haystack = `${doc.id ?? `#${i}`} ${JSON.stringify(doc)}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

/**
 * GenericDocsSection — read-only JSON-dump viewer for any appConfig/config/*
 * collection without a dedicated editor (currently Languages and Writing
 * Systems), filterable by a client-side text search over doc id + contents.
 */
const GenericDocsSection = ({ docs, isDarkMode, isLoadingDocs, error }) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDocs = useMemo(
    () => docs.filter((d, i) => matchesSearch(d, i, searchTerm)),
    [docs, searchTerm]
  );

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
          {filteredDocs.map((doc, i) => (
            <div
              key={doc.id ?? i}
              className={`p-4 rounded-xl border-2 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-50"}`}
            >
              <p className={`mb-2 font-black text-sm ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
                {doc.id ?? `#${i}`}
              </p>
              <pre className={`text-xs whitespace-pre-wrap break-words font-mono ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                {JSON.stringify(doc, null, 2)}
              </pre>
            </div>
          ))}
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
};

export default GenericDocsSection;
