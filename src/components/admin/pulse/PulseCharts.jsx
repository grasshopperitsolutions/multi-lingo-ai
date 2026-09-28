import PropTypes from "prop-types";

/**
 * The charts Admin › Pulse draws, as plain divs rather than a charting
 * library: bars, stacked bars and ranked bars are a few flex boxes, and this
 * way they take the same dark-mode classes as the rest of Admin and add
 * nothing to package.json. Line charts wait for the Phase 3 snapshot.
 */

/** Segment colours for stacked bars, in legend order; "Other" is always last. */
const SEGMENT_COLOURS = [
  "bg-yellow-400",
  "bg-sky-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-slate-400",
];

const muted = (isDarkMode) => (isDarkMode ? "text-slate-400" : "text-slate-500");
const strong = (isDarkMode) => (isDarkMode ? "text-white" : "text-slate-900");
const track = (isDarkMode) => (isDarkMode ? "bg-slate-700" : "bg-slate-100");

/** "2026-09-28" -> "28 Sep", in UTC so the label matches the bucket. */
function shortDay(day) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export const Stat = ({ label, value, hint, isDarkMode }) => (
  <div className={`rounded-2xl border-2 p-4 ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
    <p className={`text-[10px] font-black uppercase tracking-widest ${muted(isDarkMode)}`}>{label}</p>
    <p className={`text-3xl font-black tabular-nums ${strong(isDarkMode)}`}>{value}</p>
    {hint && <p className={`text-xs font-bold mt-1 ${muted(isDarkMode)}`}>{hint}</p>}
  </div>
);
Stat.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  hint: PropTypes.node,
  isDarkMode: PropTypes.bool,
};

export const ChartTitle = ({ children, isDarkMode }) => (
  <h4 className={`text-xs font-black uppercase tracking-widest mb-2 ${muted(isDarkMode)}`}>{children}</h4>
);
ChartTitle.propTypes = { children: PropTypes.node.isRequired, isDarkMode: PropTypes.bool };

/** First and last day under a daily chart, and the peak on the right. */
const DayAxis = ({ first, last, peak, isDarkMode }) => (
  <div className={`flex justify-between text-[10px] font-bold mt-1 ${muted(isDarkMode)}`}>
    <span>{shortDay(first)}</span>
    <span>peak {peak}</span>
    <span>{shortDay(last)}</span>
  </div>
);
DayAxis.propTypes = {
  first: PropTypes.string.isRequired,
  last: PropTypes.string.isRequired,
  peak: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool,
};

/** One bar per day. */
export const DailyBars = ({ data, isDarkMode, colour = "bg-yellow-400" }) => {
  if (data.length === 0) return null;
  const peak = Math.max(0, ...data.map((d) => d.count));
  return (
    <div>
      <div className={`flex items-end gap-px h-28 rounded-lg p-1 ${track(isDarkMode)}`}>
        {data.map(({ day, count }) => (
          <div
            key={day}
            title={`${shortDay(day)}: ${count}`}
            className={`flex-1 min-w-0 rounded-sm ${count ? colour : ""}`}
            style={{ height: peak ? `${(count / peak) * 100}%` : 0 }}
          />
        ))}
      </div>
      <DayAxis first={data[0].day} last={data[data.length - 1].day} peak={peak} isDarkMode={isDarkMode} />
    </div>
  );
};
DailyBars.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({ day: PropTypes.string, count: PropTypes.number })).isRequired,
  isDarkMode: PropTypes.bool,
  colour: PropTypes.string,
};

export const Legend = ({ keys, isDarkMode, labelFor = (key) => key }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
    {keys.map((key, i) => (
      <span key={key} className={`flex items-center gap-1 text-[11px] font-bold ${muted(isDarkMode)}`}>
        <span className={`w-2.5 h-2.5 rounded-sm ${SEGMENT_COLOURS[i % SEGMENT_COLOURS.length]}`} aria-hidden="true" />
        {labelFor(key)}
      </span>
    ))}
  </div>
);
Legend.propTypes = { keys: PropTypes.arrayOf(PropTypes.string).isRequired, isDarkMode: PropTypes.bool, labelFor: PropTypes.func };

/** One bar per day, split into coloured segments (see stackByDay). */
export const StackedDailyBars = ({ stack, isDarkMode, labelFor }) => {
  const { keys, days } = stack;
  if (days.length === 0) return null;
  const peak = Math.max(0, ...days.map((d) => d.total));
  return (
    <div>
      <div className={`flex items-end gap-px h-28 rounded-lg p-1 ${track(isDarkMode)}`}>
        {days.map(({ day, total, segments }) => (
          <div
            key={day}
            title={`${shortDay(day)}: ${total}${total ? ` (${keys.filter((k) => segments[k]).map((k) => `${k} ${segments[k]}`).join(", ")})` : ""}`}
            className="flex-1 min-w-0 flex flex-col-reverse rounded-sm overflow-hidden"
            style={{ height: peak ? `${(total / peak) * 100}%` : 0 }}
          >
            {keys.map((key, i) =>
              segments[key] ? (
                <div
                  key={key}
                  className={SEGMENT_COLOURS[i % SEGMENT_COLOURS.length]}
                  style={{ height: `${(segments[key] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
        ))}
      </div>
      <DayAxis first={days[0].day} last={days[days.length - 1].day} peak={peak} isDarkMode={isDarkMode} />
      {keys.length > 0 && <Legend keys={keys} labelFor={labelFor} isDarkMode={isDarkMode} />}
    </div>
  );
};
StackedDailyBars.propTypes = {
  stack: PropTypes.shape({
    keys: PropTypes.arrayOf(PropTypes.string).isRequired,
    days: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  isDarkMode: PropTypes.bool,
  labelFor: PropTypes.func,
};

/** Horizontal bars in the order given, with the count and its share. */
export const RankedBars = ({ items, isDarkMode, labelFor = (key) => key, emptyText = "Nothing yet." }) => {
  if (items.length === 0) {
    return <p className={`text-sm font-bold ${muted(isDarkMode)}`}>{emptyText}</p>;
  }
  // Not items[0]: a bucketed distribution is in bucket order, not by size.
  const total = items.reduce((sum, i) => sum + i.count, 0);
  const peak = Math.max(0, ...items.map((i) => i.count));
  return (
    <ul className="space-y-1.5">
      {items.map(({ key, count }) => (
        <li key={key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2">
          <span className={`text-xs font-bold truncate ${strong(isDarkMode)}`} title={labelFor(key)}>
            {labelFor(key)}
          </span>
          <span className={`h-3 rounded-full overflow-hidden ${track(isDarkMode)}`}>
            <span className="block h-full bg-sky-500 rounded-full" style={{ width: peak ? `${(count / peak) * 100}%` : 0 }} />
          </span>
          <span className={`text-xs font-bold tabular-nums ${muted(isDarkMode)}`}>
            {count} · {total ? Math.round((count / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
};
RankedBars.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, count: PropTypes.number })).isRequired,
  isDarkMode: PropTypes.bool,
  labelFor: PropTypes.func,
  emptyText: PropTypes.string,
};

/** A single rate as a filled bar. */
export const Ratio = ({ label, value, total, isDarkMode }) => {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className={`text-xs font-black uppercase tracking-widest ${muted(isDarkMode)}`}>{label}</span>
        <span className={`text-sm font-black tabular-nums ${strong(isDarkMode)}`}>
          {pct}% <span className={`text-xs font-bold ${muted(isDarkMode)}`}>({value} of {total})</span>
        </span>
      </div>
      <div className={`h-4 rounded-full overflow-hidden ${track(isDarkMode)}`}>
        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
Ratio.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool,
};

/** One area of the page (People, Plans & money, …). */
export const Group = ({ title, children, isDarkMode }) => (
  <section className={`rounded-2xl border-2 p-5 space-y-5 ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
    <h3 className={`text-sm font-black uppercase tracking-widest ${strong(isDarkMode)}`}>{title}</h3>
    {children}
  </section>
);
Group.propTypes = { title: PropTypes.string.isRequired, children: PropTypes.node, isDarkMode: PropTypes.bool };

export const Pill = ({ active, onClick, children, isDarkMode }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full border-2 font-black uppercase text-[11px] tracking-widest transition-all active:scale-95
      ${active
        ? "bg-yellow-400 border-yellow-400 text-slate-900"
        : isDarkMode
          ? "border-slate-600 text-slate-300"
          : "border-slate-300 text-slate-600"}`}
  >
    {children}
  </button>
);
Pill.propTypes = { active: PropTypes.bool, onClick: PropTypes.func.isRequired, children: PropTypes.node, isDarkMode: PropTypes.bool };

export const Grid = ({ children }) => <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>;
Grid.propTypes = { children: PropTypes.node };

/** Two or three charts side by side on a wide screen. */
export const Columns = ({ children }) => <div className="grid sm:grid-cols-2 gap-6">{children}</div>;
Columns.propTypes = { children: PropTypes.node };

/** A chart with its title. */
export const Chart = ({ title, children, isDarkMode }) => (
  <div>
    <ChartTitle isDarkMode={isDarkMode}>{title}</ChartTitle>
    {children}
  </div>
);
Chart.propTypes = { title: PropTypes.node.isRequired, children: PropTypes.node, isDarkMode: PropTypes.bool };

/** A stacked chart whose split the admin picks. */
export const SplitChart = ({ title, splits, split, onSplit, stack, labelFor, isDarkMode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 flex-wrap">
      <ChartTitle isDarkMode={isDarkMode}>{title}, by</ChartTitle>
      {Object.entries(splits).map(([id, s]) => (
        <Pill key={id} active={split === id} onClick={() => onSplit(id)} isDarkMode={isDarkMode}>{s.label}</Pill>
      ))}
    </div>
    <StackedDailyBars stack={stack} labelFor={labelFor} isDarkMode={isDarkMode} />
  </div>
);
SplitChart.propTypes = {
  title: PropTypes.string.isRequired,
  splits: PropTypes.object.isRequired,
  split: PropTypes.string.isRequired,
  onSplit: PropTypes.func.isRequired,
  stack: PropTypes.object.isRequired,
  labelFor: PropTypes.func,
  isDarkMode: PropTypes.bool,
};

/** Shown in place of a card whose collection could not be read. */
export const SourceError = ({ name, message, isDarkMode }) => (
  <p className={`text-xs font-bold ${isDarkMode ? "text-rose-300" : "text-rose-600"}`}>
    Could not read {name}: {message}
  </p>
);
SourceError.propTypes = { name: PropTypes.string.isRequired, message: PropTypes.string.isRequired, isDarkMode: PropTypes.bool };

/**
 * One line per day, for series that only exist since the Phase 3 counters
 * started — a trend reads better as a line than as bars. An SVG stretched to
 * the width; the stroke keeps its thickness with `vector-effect`.
 */
export const DailyLine = ({ data, isDarkMode, colour = "text-sky-500", format = (n) => n }) => {
  if (data.length === 0) return null;
  const peak = Math.max(0, ...data.map((d) => d.count));
  const points = data
    .map((d, i) => {
      const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
      const y = peak ? 100 - (d.count / peak) * 100 : 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div>
      <div className={`h-28 rounded-lg p-1 ${track(isDarkMode)}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`w-full h-full ${colour}`} role="img"
          aria-label={data.map((d) => `${d.day}: ${format(d.count)}`).join(", ")}>
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => (
            <circle
              key={d.day}
              cx={data.length === 1 ? 50 : (i / (data.length - 1)) * 100}
              cy={peak ? 100 - (d.count / peak) * 100 : 100}
              r="1.5"
              fill="currentColor"
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${shortDay(d.day)}: ${format(d.count)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <DayAxis first={data[0].day} last={data[data.length - 1].day} peak={peak} isDarkMode={isDarkMode} />
    </div>
  );
};
DailyLine.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({ day: PropTypes.string, count: PropTypes.number })).isRequired,
  isDarkMode: PropTypes.bool,
  colour: PropTypes.string,
  format: PropTypes.func,
};

/** A small table; admin-only, so plain. */
export const SimpleTable = ({ head, rows, isDarkMode, emptyText = "Nothing yet." }) => {
  if (rows.length === 0) return <p className={`text-sm font-bold ${muted(isDarkMode)}`}>{emptyText}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-bold tabular-nums">
        <thead>
          <tr className={muted(isDarkMode)}>
            {head.map((h, i) => (
              <th key={h} className={`py-1 pr-3 uppercase tracking-widest text-[10px] ${i ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className={strong(isDarkMode)}>
          {rows.map((row) => (
            <tr key={row[0]} className={`border-t ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
              {row.map((cell, i) => (
                <td key={i} className={`py-1 pr-3 ${i ? "text-right" : "text-left break-all"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
SimpleTable.propTypes = {
  head: PropTypes.arrayOf(PropTypes.string).isRequired,
  rows: PropTypes.arrayOf(PropTypes.array).isRequired,
  isDarkMode: PropTypes.bool,
  emptyText: PropTypes.string,
};
