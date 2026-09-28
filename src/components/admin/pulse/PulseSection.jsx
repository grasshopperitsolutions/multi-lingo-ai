import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { RefreshCw } from "lucide-react";
import Loader from "../../Loader";
import { GhostButton } from "../../ui";
import { auth } from "../../../firebase";
import { loadPulseData } from "../../../services/pulseService";
import { todayUTC } from "../../../utils/aiUsage";
import { inPeriod, periodForDays, summarizeUsers } from "../../../utils/pulseMetrics";
import { Grid, Pill, Stat } from "./PulseCharts";
import PeopleGroup from "./PeopleGroup";
import PlansGroup from "./PlansGroup";
import ContentGroup from "./ContentGroup";
import UsageGroup from "./UsageGroup";
import CommunityGroup from "./CommunityGroup";
import MessagingGroup from "./MessagingGroup";

/**
 * Admin › Pulse — how the app is being used, from what Firestore already
 * holds. Phases 1 and 2 of plans/app-current-pulse.md: read-only, computed in
 * the browser, counts only. Loaded lazily from AdminPage.
 *
 * This file owns loading, the period and the headline row; each area of the
 * page is its own group component, handed one `pulse` object with the data
 * and the context every group needs.
 *
 * Admin copy is English on purpose — admin panels are exempt from the
 * translation pipeline.
 */

const PERIOD_PRESETS = [1, 7, 30, 90];

const PulseSection = ({ isDarkMode, onOpenReports }) => {
  const [data, setData] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preset, setPreset] = useState(7); // a number of days, or "custom"
  const [custom, setCustom] = useState(() => periodForDays(7, todayUTC()));

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      setData(await loadPulseData(token));
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // "Today" is fixed at load time, so the numbers and the day buckets agree
  // even if the page stays open past midnight UTC.
  const today = loadedAt ? loadedAt.toISOString().slice(0, 10) : todayUTC();
  const period = useMemo(() => {
    if (preset !== "custom") return periodForDays(preset, today);
    return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
  }, [preset, custom, today]);

  const pulse = useMemo(() => {
    if (!data) return null;
    const languageLabels = Object.fromEntries(data.languages.map((l) => [l.code ?? l.id, l.label || l.code || l.id]));
    const periodDays = preset === "custom" ? null : preset;
    return {
      data,
      period,
      today,
      periodName: periodDays ? `last ${periodDays === 1 ? "day" : `${periodDays} days`}` : "this range",
      isDarkMode,
      people: summarizeUsers(data.users, data.tiersConfig, { today, nowMs: loadedAt.getTime(), period }),
      usersById: Object.fromEntries(data.users.map((u) => [u.uid, u])),
      langLabel: (code) => (languageLabels[code] ? `${languageLabels[code]} (${code})` : code),
      tierLabel: (id) => data.tiersConfig?.[id]?.label ?? id,
    };
  }, [data, loadedAt, today, period, preset, isDarkMode]);

  if (isLoading && !data) return <Loader message="Taking the pulse..." isDarkMode={isDarkMode} />;

  if (error && !data) {
    return (
      <div className="space-y-3">
        <p className={`font-bold text-sm ${isDarkMode ? "text-rose-300" : "text-rose-600"}`}>{error}</p>
        <GhostButton onClick={load} isDarkMode={isDarkMode} className="!px-4 !py-2 !text-xs">Try again</GhostButton>
      </div>
    );
  }

  if (!pulse) return null;

  const { people, periodName } = pulse;
  const openReports = data.reports.filter((r) => !r.read).length;
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const dateInput = `rounded-lg border-2 px-2 py-1 text-xs font-bold ${isDarkMode ? "bg-slate-900 border-slate-600 text-white [color-scheme:dark]" : "bg-white border-slate-300 text-slate-900"}`;

  return (
    <div className="space-y-6">
      {/* Period picker */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_PRESETS.map((days) => (
          <Pill key={days} active={preset === days} onClick={() => setPreset(days)} isDarkMode={isDarkMode}>
            {days === 1 ? "1 day" : `${days} days`}
          </Pill>
        ))}
        <Pill active={preset === "custom"} onClick={() => setPreset("custom")} isDarkMode={isDarkMode}>Custom</Pill>
        {preset === "custom" && (
          <span className="flex items-center gap-1">
            <input
              type="date"
              aria-label="From"
              value={custom.from}
              max={today}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))}
              className={dateInput}
            />
            <span className={`text-xs font-bold ${muted}`}>to</span>
            <input
              type="date"
              aria-label="To"
              value={custom.to}
              max={today}
              onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))}
              className={dateInput}
            />
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <span className={`text-[11px] font-bold ${muted}`}>
            UTC days · loaded {loadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            aria-label="Reload"
            className={`p-1.5 rounded-lg border-2 ${isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"}`}
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </span>
      </div>

      {/* Headline numbers */}
      <Grid>
        <Stat label="Total users" value={people.total} isDarkMode={isDarkMode} />
        <Stat
          label={`Sign-ups, ${periodName}`}
          value={people.signUpsInPeriod}
          hint={`${people.signUpsBefore} in the period before`}
          isDarkMode={isDarkMode}
        />
        <Stat label="Open reports" value={openReports} hint={`${inPeriod(data.reports, period).length} new, ${periodName}`} isDarkMode={isDarkMode} />
        <Stat label="Seen today" value={people.active.day1} isDarkMode={isDarkMode} />
        <Stat label="Seen in 7 days" value={people.active.day7} isDarkMode={isDarkMode} />
        <Stat label="Seen in 30 days" value={people.active.day30} isDarkMode={isDarkMode} />
      </Grid>

      <PeopleGroup pulse={pulse} />
      <PlansGroup pulse={pulse} />
      <ContentGroup pulse={pulse} />
      <UsageGroup pulse={pulse} />
      <CommunityGroup pulse={pulse} onOpenReports={onOpenReports} />
      <MessagingGroup pulse={pulse} />

      <p className={`text-xs font-bold leading-relaxed ${muted}`}>
        Known limits: “seen”, dormancy and streaks come from the last day each person opened the app signed in, not a
        daily history, so they ignore the period picker. AI calls are today only. Reads, completions, preferences and
        the outbox are as they stand now. Guests and anything generated without being saved (translator, dictionary,
        tutor sessions…) leave no trace here. Word sources and translations per language live in subcollections and
        wait for the daily snapshot.
      </p>
    </div>
  );
};

PulseSection.propTypes = {
  isDarkMode: PropTypes.bool,
  onOpenReports: PropTypes.func,
};

export default PulseSection;
