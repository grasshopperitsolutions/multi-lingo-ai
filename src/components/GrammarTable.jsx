import PropTypes from "prop-types";

/**
 * GrammarTable
 *
 * Conjugation / declension tables for the grammar library.
 *
 * Each row is { cells: string[] } rather than a bare array — Firestore
 * rejects an array that directly contains another array, so the wrapper is
 * how table rows survive being written at all. Rows are also assumed
 * rectangular: grammarService._sanitizeTables drops any row whose cell count
 * doesn't match the headers, precisely so this renderer can map cells to
 * columns positionally without misaligning the data.
 *
 * The wrapper scrolls horizontally on its own: a five-column verb table has to
 * stay readable on a phone without the whole page scrolling sideways.
 */
const GrammarTable = ({ caption, headers, rows, isDarkMode }) => {
  if (!headers?.length || !rows?.length) return null;

  return (
    <figure className="flex flex-col gap-2">
      {caption && (
        <figcaption className={`text-xs font-black uppercase tracking-widest ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          {caption}
        </figcaption>
      )}

      <div className="overflow-x-auto">
        <table className={`w-full min-w-max border-collapse rounded-xl overflow-hidden border-2 ${
          isDarkMode ? "border-slate-700" : "border-slate-300"
        }`}>
          <thead>
            <tr className={isDarkMode ? "bg-slate-700" : "bg-slate-100"}>
              {headers.map((header, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`px-3 py-2 text-left text-xs font-black uppercase tracking-widest whitespace-nowrap ${
                    isDarkMode ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex % 2 === 0
                    ? isDarkMode ? "bg-slate-900" : "bg-white"
                    : isDarkMode ? "bg-slate-800/60" : "bg-slate-50"
                }
              >
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`px-3 py-2 text-sm whitespace-nowrap ${
                      cellIndex === 0
                        ? isDarkMode ? "font-bold text-slate-300" : "font-bold text-slate-600"
                        : isDarkMode ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
};

GrammarTable.propTypes = {
  caption: PropTypes.string,
  headers: PropTypes.arrayOf(PropTypes.string),
  rows: PropTypes.arrayOf(PropTypes.shape({ cells: PropTypes.arrayOf(PropTypes.string) })),
  isDarkMode: PropTypes.bool.isRequired,
};

export default GrammarTable;
