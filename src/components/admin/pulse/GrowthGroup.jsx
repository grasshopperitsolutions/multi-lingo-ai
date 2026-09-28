import { useMemo } from "react";
import PropTypes from "prop-types";
import {
  formatMoney,
  inPeriod,
  latestSnapshot,
  rankBy,
  rankMap,
  retentionTable,
  seriesFromDocs,
  sumCounters,
} from "../../../utils/pulseMetrics";
import { Chart, Columns, DailyLine, Grid, Group, RankedBars, SimpleTable, SourceError, Stat } from "./PulseCharts";

const n = (value) => Number(value || 0).toLocaleString();

const PERSONAL_LABELS = {
  personalPhrases: "Phrasebook",
  personalMistakes: "Mistake journal",
  personalQuestions: "Questions",
  personalNotes: "Note board",
};

/**
 * Where people come from, whether they stay, and what they pay — plus what
 * only the daily snapshot (`appConfig/pulse/days/{day}`) can count: login
 * recency from Firebase Auth, personal-space use, word sources, translations
 * per interface language, and revenue read from Stripe.
 */
const GrowthGroup = ({ pulse }) => {
  const { data, period, periodName, today, isDarkMode, tierLabel, langLabel } = pulse;

  const m = useMemo(() => {
    const summed = sumCounters(data.pulseCounters, period);
    const joined = inPeriod(data.users, period);
    const snapshot = latestSnapshot(data.pulseDays);
    const currencies = Object.keys(snapshot?.revenue?.mrr ?? {});
    const mainCurrency = currencies[0];
    return {
      joined,
      byReferrer: rankBy(joined, (u) => u.acquisition?.referrerHost, "Direct or unknown"),
      bySource: rankBy(joined, (u) => u.acquisition?.utmSource, "No campaign"),
      byCampaign: rankBy(joined.filter((u) => u.acquisition?.utmCampaign), (u) => u.acquisition.utmCampaign),
      retention: retentionTable(data.pulseWeeks, data.users, { today }),
      planChanges: rankMap(summed.planChanges),
      planMoves: rankMap(summed.planMoves),
      snapshot,
      mainCurrency,
      mrrByDay: mainCurrency
        ? seriesFromDocs(data.pulseDays, period, (doc) => (doc.revenue?.mrr?.[mainCurrency] ?? 0) / 100)
        : [],
      usersByDay: seriesFromDocs(data.pulseDays, period, ["users", "total"]),
    };
  }, [data, period, today]);

  const { snapshot } = m;
  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const text = isDarkMode ? "text-slate-200" : "text-slate-700";
  const errors = { ...data.errors, ...(snapshot?.errors ?? {}) };
  const pct = (count, size) => (size ? `${count} (${Math.round((count / size) * 100)}%)` : String(count));

  return (
    <Group title="Growth & money" isDarkMode={isDarkMode}>
      {data.errors.pulseDays && <SourceError name="the daily snapshots" message={data.errors.pulseDays} isDarkMode={isDarkMode} />}
      {data.errors.pulseWeeks && <SourceError name="the weekly actives" message={data.errors.pulseWeeks} isDarkMode={isDarkMode} />}

      <Columns>
        <Chart title={`Where sign-ups came from, ${periodName} (${m.joined.length})`} isDarkMode={isDarkMode}>
          <RankedBars items={m.byReferrer} emptyText="No sign-ups in this period." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Campaign source (utm_source)" isDarkMode={isDarkMode}>
          <RankedBars items={m.bySource} emptyText="No sign-ups in this period." isDarkMode={isDarkMode} />
        </Chart>
      </Columns>
      {m.byCampaign.length > 0 && (
        <Chart title="Campaign (utm_campaign)" isDarkMode={isDarkMode}>
          <RankedBars items={m.byCampaign} isDarkMode={isDarkMode} />
        </Chart>
      )}
      <p className={`text-[11px] font-bold ${muted}`}>
        First touch, recorded at sign-up from the day the Phase 3 app shipped. Earlier accounts read as direct or unknown.
      </p>

      <Chart title="Early retention: active in the weeks after signing up" isDarkMode={isDarkMode}>
        <SimpleTable
          head={["Sign-up week", "People", "Week +1", "+2", "+3", "+4"]}
          rows={m.retention.map((r) => [
            r.cohort,
            r.size,
            ...r.weeks.map((count) => (count === null ? "" : pct(count, r.size))),
          ])}
          emptyText="Nothing yet."
          isDarkMode={isDarkMode}
        />
        <p className={`text-[11px] font-bold mt-1 ${muted}`}>
          Weekly actives are counted from the day the Phase 3 API was deployed; weeks before that read as zero.
        </p>
      </Chart>

      <Columns>
        <Chart title={`Plan changes, ${periodName}`} isDarkMode={isDarkMode}>
          <RankedBars items={m.planChanges} emptyText="None." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Moves between tiers" isDarkMode={isDarkMode}>
          <RankedBars
            items={m.planMoves}
            labelFor={(key) => key.split("_to_").map(tierLabel).join(" → ")}
            emptyText="None."
            isDarkMode={isDarkMode}
          />
        </Chart>
      </Columns>

      {!snapshot ? (
        <p className={`text-sm font-bold ${muted}`}>
          No daily snapshot yet. The first is written at 06:00 UTC after the Phase 3 API is deployed.
        </p>
      ) : (
        <>
          <p className={`text-[11px] font-bold ${muted}`}>Latest snapshot: {snapshot.id}.</p>
          {Object.entries(errors)
            .filter(([key]) => ["revenue", "lastSeen", "personalSpace", "wordTranslations", "contentTranslations", "users", "pools"].includes(key))
            .map(([key, message]) => (
              <SourceError key={key} name={`the snapshot's ${key}`} message={String(message)} isDarkMode={isDarkMode} />
            ))}

          <Grid>
            <Stat label="Monthly recurring revenue" value={formatMoney(snapshot.revenue?.mrr)} hint="From Stripe; trials excluded" isDarkMode={isDarkMode} />
            <Stat label="Paying subscriptions" value={n(snapshot.revenue?.active)} hint={`${n(snapshot.revenue?.trialing)} on trial`} isDarkMode={isDarkMode} />
            <Stat label="Logged in, last 24 h" value={n(snapshot.lastSeen?.within1Day)} hint="By login-token renewal" isDarkMode={isDarkMode} />
            <Stat label="Logged in, last 7 days" value={n(snapshot.lastSeen?.within7Days)} hint={`${n(snapshot.lastSeen?.within30Days)} in 30 days`} isDarkMode={isDarkMode} />
          </Grid>

          <Chart title="Revenue by tier" isDarkMode={isDarkMode}>
            <SimpleTable
              head={["Tier", "Subscriptions", "MRR"]}
              rows={Object.entries(snapshot.revenue?.byTier ?? {}).map(([tier, v]) => [tierLabel(tier), n(v.subscriptions), formatMoney(v.mrr)])}
              emptyText="No paying subscriptions."
              isDarkMode={isDarkMode}
            />
          </Chart>

          <Columns>
            {m.mainCurrency && (
              <Chart title={`MRR over time (${m.mainCurrency.toUpperCase()})`} isDarkMode={isDarkMode}>
                <DailyLine data={m.mrrByDay} colour="text-emerald-500" format={(v) => v.toFixed(2)} isDarkMode={isDarkMode} />
              </Chart>
            )}
            <Chart title="Total users over time" isDarkMode={isDarkMode}>
              <DailyLine data={m.usersByDay} isDarkMode={isDarkMode} />
            </Chart>
          </Columns>

          <Chart title="Personal space" isDarkMode={isDarkMode}>
            <SimpleTable
              head={["List", "People keeping one", "Entries"]}
              rows={Object.entries(snapshot.personalSpace ?? {}).map(([key, v]) => [PERSONAL_LABELS[key] ?? key, n(v.people), n(v.items)])}
              isDarkMode={isDarkMode}
            />
          </Chart>

          <Columns>
            <Chart title="Word pool translations, by source" isDarkMode={isDarkMode}>
              <RankedBars items={rankMap(snapshot.wordTranslations?.bySource)} isDarkMode={isDarkMode} />
            </Chart>
            <Chart title="Word pool translations, by language" isDarkMode={isDarkMode}>
              <RankedBars items={rankMap(snapshot.wordTranslations?.byLocale)} labelFor={langLabel} isDarkMode={isDarkMode} />
            </Chart>
            <Chart title="Tale translations, by language" isDarkMode={isDarkMode}>
              <RankedBars items={rankMap(snapshot.contentTranslations?.stories)} labelFor={langLabel} isDarkMode={isDarkMode} />
            </Chart>
            <Chart title="Culture piece translations, by language" isDarkMode={isDarkMode}>
              <RankedBars items={rankMap(snapshot.contentTranslations?.historyFacts)} labelFor={langLabel} isDarkMode={isDarkMode} />
            </Chart>
          </Columns>
          <p className={`text-xs font-bold ${text}`}>
            Snapshot counts are as they stood at the end of {snapshot.id}; the period picker only moves the lines.
          </p>
        </>
      )}
    </Group>
  );
};

GrowthGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default GrowthGroup;
