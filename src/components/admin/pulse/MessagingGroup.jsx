import { useMemo } from "react";
import PropTypes from "prop-types";
import { mailQueueSummary, messagingSummary } from "../../../utils/pulseMetrics";
import { Chart, DailyBars, Grid, Group, RankedBars, SourceError, Stat } from "./PulseCharts";

const REMINDER_LABELS = {
  streakRescue: "Streak rescue",
  practiceNudge: "Practice nudge",
  lessonsLow: "Lessons running low",
  weeklyReview: "Weekly review",
};

/** Push, reminders, opt-outs and the broadcast outbox. */
const MessagingGroup = ({ pulse }) => {
  const { data, period, periodName, isDarkMode } = pulse;
  const { errors } = data;

  const m = useMemo(() => ({
    messaging: messagingSummary(data.users),
    mail: mailQueueSummary(data.mailQueue, period),
  }), [data, period]);

  return (
    <Group title="Messaging" isDarkMode={isDarkMode}>
      <Grid>
        <Stat label="Push enabled" value={m.messaging.pushEnabled} hint={`${m.messaging.browsers} browsers registered`} isDarkMode={isDarkMode} />
        <Stat label="Opted out: announcement email" value={m.messaging.optOuts.announcementsEmail} isDarkMode={isDarkMode} />
        <Stat label="Opted out: announcement push" value={m.messaging.optOuts.announcementsPush} isDarkMode={isDarkMode} />
        <Stat label="Opted out: reminder push" value={m.messaging.optOuts.remindersPush} isDarkMode={isDarkMode} />
      </Grid>
      <Chart title="Reminders on, among people with push" isDarkMode={isDarkMode}>
        <RankedBars
          items={m.messaging.remindersOn}
          labelFor={(id) => REMINDER_LABELS[id] ?? id}
          emptyText="Nobody has push on."
          isDarkMode={isDarkMode}
        />
      </Chart>

      {errors.mailQueue && <SourceError name="the mail queue" message={errors.mailQueue} isDarkMode={isDarkMode} />}
      <Grid>
        <Stat label="Emails waiting" value={m.mail.pending} hint="Released 75 a day" isDarkMode={isDarkMode} />
        <Stat label="Emails failed" value={m.mail.failed} isDarkMode={isDarkMode} />
        <Stat label={`Emails queued, ${periodName}`} value={m.mail.queuedInPeriod} isDarkMode={isDarkMode} />
      </Grid>
      <Chart title="Broadcast emails sent per day" isDarkMode={isDarkMode}>
        <DailyBars data={m.mail.sentByDay} colour="bg-orange-500" isDarkMode={isDarkMode} />
      </Chart>
    </Group>
  );
};

MessagingGroup.propTypes = { pulse: PropTypes.object.isRequired };

export default MessagingGroup;
