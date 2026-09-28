import PropTypes from "prop-types";
import { Chart, Grid, Group, RankedBars, Stat } from "./PulseCharts";

/** Tiers, subscriptions and today's AI allowance. */
const PlansGroup = ({ pulse }) => {
  const { people, tierLabel, isDarkMode } = pulse;
  return (
    <Group title="Plans & money" isDarkMode={isDarkMode}>
      <Chart title="Users per tier" isDarkMode={isDarkMode}>
        <RankedBars items={people.tiers} labelFor={tierLabel} isDarkMode={isDarkMode} />
      </Chart>
      <Grid>
        <Stat label="Active subscriptions" value={people.subscriptions.active} hint={`${people.subscriptions.cancelScheduled} set to cancel`} isDarkMode={isDarkMode} />
        <Stat label="Past due" value={people.subscriptions.pastDue} isDarkMode={isDarkMode} />
        <Stat label="Cancelled" value={people.subscriptions.cancelled} isDarkMode={isDarkMode} />
        <Stat label="Renewals in 7 days" value={people.subscriptions.renewalsDue} isDarkMode={isDarkMode} />
        <Stat label="AI calls today" value={people.ai.total} hint="Resets at 00:00 UTC" isDarkMode={isDarkMode} />
        <Stat label="Free users at limit" value={people.ai.freeAtLimit} hint="Used today's whole allowance" isDarkMode={isDarkMode} />
      </Grid>
      <Chart title="AI calls today, by tier" isDarkMode={isDarkMode}>
        <RankedBars items={people.ai.byTier} labelFor={tierLabel} emptyText="No AI calls yet today." isDarkMode={isDarkMode} />
      </Chart>
    </Group>
  );
};

PlansGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default PlansGroup;
