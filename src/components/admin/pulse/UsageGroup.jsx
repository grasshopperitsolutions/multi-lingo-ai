import { useMemo } from "react";
import PropTypes from "prop-types";
import { resolveVoice } from "../../../config/aiVoices";
import { bucketize, rankBy, rankListEntries, WORD_BANK_BUCKETS } from "../../../utils/pulseMetrics";
import { Chart, Columns, Grid, Group, RankedBars, Stat } from "./PulseCharts";

/** Which features people keep close, and how they have set the app up. */
const UsageGroup = ({ pulse }) => {
  const { data, isDarkMode } = pulse;
  const { users } = data;

  const m = useMemo(() => {
    const bankSizes = users.map((u) => (Array.isArray(u.favWordIds) ? u.favWordIds.length : 0));
    return {
      favouriteFeatures: rankListEntries(users, (u) => u.favFeatureIds),
      bankSizes: bucketize(bankSizes, WORD_BANK_BUCKETS),
      wordsBanked: bankSizes.reduce((a, b) => a + b, 0),
      theme: rankBy(users, (u) => u.theme, "Not set (light)"),
      // Only an explicit false turns the cursor off; absent is on.
      cursorOff: users.filter((u) => u.customCursor === false).length,
      // Resolved as the app resolves it, so an unset or retired voice counts
      // as the default everyone is actually hearing.
      voices: rankBy(users, (u) => resolveVoice(u.preferredVoice)),
      presentation: rankBy(users, (u) => u.dashboardPresentation, "Automatic"),
      hiddenWidgets: rankListEntries(users, (u) => u.hiddenPersonalWidgets),
    };
  }, [users]);

  return (
    <Group title="What people use" isDarkMode={isDarkMode}>
      <Columns>
        <Chart title="Favourite features" isDarkMode={isDarkMode}>
          <RankedBars items={m.favouriteFeatures} emptyText="No favourites yet." isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Word bank sizes" isDarkMode={isDarkMode}>
          <RankedBars items={m.bankSizes} isDarkMode={isDarkMode} />
        </Chart>
      </Columns>
      <Grid>
        <Stat label="Words banked" value={m.wordsBanked} hint="Across all users" isDarkMode={isDarkMode} />
        <Stat label="Compass cursor off" value={m.cursorOff} isDarkMode={isDarkMode} />
      </Grid>
      <Columns>
        <Chart title="Theme" isDarkMode={isDarkMode}>
          <RankedBars items={m.theme} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="AI voice" isDarkMode={isDarkMode}>
          <RankedBars items={m.voices} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Dashboard layout" isDarkMode={isDarkMode}>
          <RankedBars items={m.presentation} isDarkMode={isDarkMode} />
        </Chart>
        <Chart title="Hidden personal widgets" isDarkMode={isDarkMode}>
          <RankedBars items={m.hiddenWidgets} emptyText="Nobody has hidden one." isDarkMode={isDarkMode} />
        </Chart>
      </Columns>
    </Group>
  );
};

UsageGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default UsageGroup;
