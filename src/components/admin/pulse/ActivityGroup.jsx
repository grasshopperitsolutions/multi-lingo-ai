import { useMemo } from "react";
import PropTypes from "prop-types";
import { aiByFeature, rankMap, seriesFromDocs, sumCounters, sumLeafKey, sumLeaves, valueAt } from "../../../utils/pulseMetrics";
import { Chart, Columns, DailyLine, Grid, Group, RankedBars, SimpleTable, SourceError, Stat } from "./PulseCharts";

const n = (value) => Number(value || 0).toLocaleString();

/**
 * What happened, day by day, from the counters the API keeps
 * (`appConfig/pulse/counters/{day}`): daily actives, AI calls and tokens per
 * feature and per model, the daily limit being hit, live tutor sessions and
 * minutes, page opens, locked attempts and account deletions.
 *
 * All of it starts on the day the Phase 3 API was deployed. Before that the
 * lines are flat at zero, which is "not counted yet", not "nobody came".
 */
const ActivityGroup = ({ pulse }) => {
  const { data, period, periodName, today, isDarkMode, tierLabel } = pulse;
  const counters = data.pulseCounters;

  const m = useMemo(() => {
    const summed = sumCounters(counters, period);
    const byDay = Object.fromEntries(counters.map((d) => [d.id, d]));
    const dau = seriesFromDocs(counters, period, ["activeUsers", "total"]);
    const daysWithData = dau.filter((d) => byDay[d.day]).length;
    return {
      summed,
      dau,
      dauToday: valueAt(byDay[today], ["activeUsers", "total"]),
      dauAverage: daysWithData ? dau.reduce((s, d) => s + d.count, 0) / daysWithData : 0,
      // `total` sits beside the tiers in the same map; the bars are the tiers.
      activeByTier: rankMap(Object.fromEntries(Object.entries(summed.activeUsers ?? {}).filter(([k]) => k !== "total"))),
      aiCallsByDay: seriesFromDocs(counters, period, (doc) => sumLeafKey(doc.ai, "calls")),
      features: aiByFeature(summed),
      models: Object.entries(summed.models ?? {})
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => (b.calls ?? 0) - (a.calls ?? 0)),
      limitHits: rankMap(summed.limitHits),
      liveSessions: rankMap(summed.liveSessions),
      liveMinutes: sumLeaves(summed.liveSeconds) / 60,
      pageOpens: rankMap(summed.pageOpens),
      locked: rankMap(summed.locked),
      deletions: summed.accountDeletions ?? {},
      // What the picture games cost: drawn once per word on the server, outside
      // the daily allowance, so this is the only place the spend shows.
      pictures: summed.pictures ?? {},
    };
  }, [counters, period, today]);

  const total = (key) => sumLeafKey(m.summed.ai, key);
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <Group title="Activity & AI" isDarkMode={isDarkMode}>
      {data.errors.pulseCounters && (
        <SourceError name="the daily counters" message={data.errors.pulseCounters} isDarkMode={isDarkMode} />
      )}
      {counters.length === 0 && !data.errors.pulseCounters && (
        <p className={`text-sm font-bold ${muted}`}>
          No counters yet. They start the day the Phase 3 API is deployed.
        </p>
      )}

      <Grid>
        <Stat label="Active today" value={n(m.dauToday)} hint="Counted once each" isDarkMode={isDarkMode} />
        <Stat label={`Average daily actives, ${periodName}`} value={m.dauAverage.toFixed(1)} hint="Over days with data" isDarkMode={isDarkMode} />
        <Stat label={`AI calls, ${periodName}`} value={n(total("calls"))} hint={`${n(total("cached"))} served from cache`} isDarkMode={isDarkMode} />
        <Stat label="Tokens in / out" value={`${n(total("inputTokens"))} / ${n(total("outputTokens"))}`} hint={`${n(total("thinkingTokens"))} thinking`} isDarkMode={isDarkMode} />
        <Stat label="Daily limit hit" value={n(sumLeaves(m.summed.limitHits))} hint="Refused calls" isDarkMode={isDarkMode} />
        <Stat label="Live tutor" value={`${n(sumLeaves(m.summed.liveSessions))} sessions`} hint={`${m.liveMinutes.toFixed(0)} minutes, as reported by browsers`} isDarkMode={isDarkMode} />
        <Stat
          label={`Pictures drawn, ${periodName}`}
          value={n(m.pictures.generated)}
          hint={`${n(m.pictures.scenes)} scenes · ${n(m.pictures.failed)} declined · ${n(m.pictures.skipped)} not drawable`}
          isDarkMode={isDarkMode}
        />
        <Stat
          label="Picture cap hit"
          value={n(m.pictures.capped)}
          hint={`${n(m.pictures.reports)} pictures reported`}
          isDarkMode={isDarkMode}
        />
      </Grid>

      <Columns>
        <Chart title="Daily active users" isDarkMode={isDarkMode}>
          <DailyLine data={m.dau} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="AI calls per day" isDarkMode={isDarkMode}>
          <DailyLine data={m.aiCallsByDay} colour="text-violet-500" isDarkMode={isDarkMode} />
        </Chart>
      </Columns>

      <Chart title={`AI use by feature, ${periodName}`} isDarkMode={isDarkMode}>
        <SimpleTable
          head={["Prompt", "Calls", "Cached", "Refused", "Errors", "Tokens in", "Tokens out", "Thinking"]}
          rows={m.features.map((f) => [
            f.key, n(f.calls), n(f.cached), n(f.refused), n(f.errors), n(f.inputTokens), n(f.outputTokens), n(f.thinkingTokens),
          ])}
          emptyText="No AI calls counted in this period."
          isDarkMode={isDarkMode}
        />
      </Chart>

      <Chart title={`Tokens by model, ${periodName}`} isDarkMode={isDarkMode}>
        <SimpleTable
          head={["Model", "Calls", "Tokens in", "Tokens out", "Thinking"]}
          rows={m.models.map((r) => [r.model, n(r.calls), n(r.inputTokens), n(r.outputTokens), n(r.thinkingTokens)])}
          emptyText="Nothing yet."
          isDarkMode={isDarkMode}
        />
        <p className={`text-[11px] font-bold mt-1 ${muted}`}>
          Cost is tokens × each model&apos;s price; prices are not stored here, so check them against the provider.
        </p>
      </Chart>

      <Columns>
        <Chart title="Active users by tier (summed over days)" isDarkMode={isDarkMode}>
          <RankedBars items={m.activeByTier} labelFor={tierLabel} emptyText="Nothing yet." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Daily limit hit, by tier" isDarkMode={isDarkMode}>
          <RankedBars items={m.limitHits} labelFor={tierLabel} emptyText="Nobody hit it." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Feature pages opened" isDarkMode={isDarkMode}>
          <RankedBars items={m.pageOpens} emptyText="Nothing yet." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Locked features reached for" isDarkMode={isDarkMode}>
          <RankedBars items={m.locked} emptyText="Nobody reached for one." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Live tutor sessions, by tier" isDarkMode={isDarkMode}>
          <RankedBars items={m.liveSessions} labelFor={tierLabel} emptyText="None." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title={`Accounts deleted, ${periodName}`} isDarkMode={isDarkMode}>
          <p className={`text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
            {n(m.deletions.self)} by their owner, {n(m.deletions.admin)} by an admin.
          </p>
        </Chart>
      </Columns>
    </Group>
  );
};

ActivityGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default ActivityGroup;
