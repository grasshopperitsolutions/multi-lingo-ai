import { useMemo } from "react";
import PropTypes from "prop-types";
import {
  countDormant,
  rankBy,
  rankListEntries,
  regionOfTimezone,
  practiceSummary,
} from "../../../utils/pulseMetrics";
import { Chart, Columns, DailyBars, Grid, Group, RankedBars, Ratio, Stat } from "./PulseCharts";

/** Who uses the app: sign-ups, onboarding, languages, practice days, where, interests. */
const PeopleGroup = ({ pulse }) => {
  const { data, people, today, isDarkMode, langLabel } = pulse;
  const { users, categories } = data;

  const extra = useMemo(() => {
    const categoryLabels = Object.fromEntries((categories ?? []).map((c) => [c.id, c.label || c.id]));
    return {
      dormant: countDormant(users, 30, today),
      practice: practiceSummary(users, today),
      regions: rankBy(users, (u) => regionOfTimezone(u.timezone)),
      zones: rankBy(users, (u) => u.timezone).slice(0, 10),
      interests: rankListEntries(users, (u) => u.interests),
      categoryLabel: (id) => categoryLabels[id] ?? id,
      providers: rankBy(users, (u) => u.provider),
    };
  }, [users, categories, today]);

  return (
    <Group title="People" isDarkMode={isDarkMode}>
      <Chart title="Sign-ups per day" isDarkMode={isDarkMode}>
        <DailyBars data={people.signUpsByDay} isDarkMode={isDarkMode} />
      </Chart>
      <Ratio label="Onboarding completed" value={people.onboarding.completed} total={people.onboarding.total} isDarkMode={isDarkMode} />
      <Columns>
        <Chart title="Interface languages" isDarkMode={isDarkMode}>
          <RankedBars items={people.interfaceLangs} labelFor={langLabel} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Practice languages" isDarkMode={isDarkMode}>
          <RankedBars items={people.practiceLangs} labelFor={langLabel} isDarkMode={isDarkMode} />
        </Chart>
      </Columns>

      <Grid>
        <Stat label="Dormant" value={extra.dormant} hint="Not seen for over 30 days" isDarkMode={isDarkMode} />
        <Stat label="Practised 3+ days this week" value={extra.practice.threePlus} hint="Last 7 days" isDarkMode={isDarkMode} />
        <Stat label="Best month, anyone" value={extra.practice.bestMonthEver} hint="Practice days in one month" isDarkMode={isDarkMode} />
      </Grid>
      <Columns>
        <Chart title="Practice days, last 7" isDarkMode={isDarkMode}>
          <RankedBars items={extra.practice.distribution} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Sign-in method" isDarkMode={isDarkMode}>
          <RankedBars items={extra.providers} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Region (from timezone)" isDarkMode={isDarkMode}>
          <RankedBars items={extra.regions} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Top timezones" isDarkMode={isDarkMode}>
          <RankedBars items={extra.zones} isDarkMode={isDarkMode} />
        </Chart>
      </Columns>
      <Chart title="Interests chosen" isDarkMode={isDarkMode}>
        <RankedBars items={extra.interests} labelFor={extra.categoryLabel} emptyText="Nobody has picked one yet." isDarkMode={isDarkMode} />
      </Chart>
    </Group>
  );
};

PeopleGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default PeopleGroup;
