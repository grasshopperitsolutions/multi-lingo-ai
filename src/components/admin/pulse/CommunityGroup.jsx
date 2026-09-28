import { useMemo } from "react";
import PropTypes from "prop-types";
import { GhostButton } from "../../ui";
import { countByDay, inPeriod, previousPeriod, tutorSummary } from "../../../utils/pulseMetrics";
import { Chart, DailyBars, Grid, Group, RankedBars, SourceError, Stat } from "./PulseCharts";

/** Reports, tutors and contact messages. */
const CommunityGroup = ({ pulse, onOpenReports }) => {
  const { data, period, periodName, isDarkMode, langLabel } = pulse;
  const { errors } = data;

  const m = useMemo(() => ({
    reports: {
      open: data.reports.filter((r) => !r.read).length,
      newInPeriod: inPeriod(data.reports, period).length,
      newBefore: inPeriod(data.reports, previousPeriod(period)).length,
    },
    tutors: tutorSummary(data.tutors, period),
    applicationsWaiting: data.tutorApplications.filter((a) => !a.read).length,
    contact: {
      inPeriod: inPeriod(data.contactSubmissions, period).length,
      byDay: countByDay(data.contactSubmissions, period),
    },
  }), [data, period]);

  const error = (key, name) => errors[key] && <SourceError name={name} message={errors[key]} isDarkMode={isDarkMode} />;

  return (
    <Group title="Community & support" isDarkMode={isDarkMode}>
      <Grid>
        <Stat label="Open reports" value={m.reports.open} isDarkMode={isDarkMode} />
        <Stat label={`New reports, ${periodName}`} value={m.reports.newInPeriod} hint={`${m.reports.newBefore} in the period before`} isDarkMode={isDarkMode} />
      </Grid>
      {onOpenReports && (
        <GhostButton onClick={onOpenReports} isDarkMode={isDarkMode} className="!px-4 !py-2 !text-xs">
          Open Reports
        </GhostButton>
      )}

      {error("tutors", "tutors")}
      {error("tutorApplications", "tutor applications")}
      <Grid>
        <Stat label="Tutors published" value={m.tutors.published} hint={`${m.tutors.hidden} hidden`} isDarkMode={isDarkMode} />
        <Stat label={`New tutors, ${periodName}`} value={m.tutors.newInPeriod} isDarkMode={isDarkMode} />
        <Stat label="Tutor applications waiting" value={m.applicationsWaiting} hint="Unread" isDarkMode={isDarkMode} />
      </Grid>
      <Chart title="Languages offered by published tutors" isDarkMode={isDarkMode}>
        <RankedBars items={m.tutors.languages} labelFor={langLabel} emptyText="None listed." isDarkMode={isDarkMode} />
      </Chart>

      {error("contactSubmissions", "contact messages")}
      <Grid>
        <Stat label={`Contact messages, ${periodName}`} value={m.contact.inPeriod} isDarkMode={isDarkMode} />
      </Grid>
      <Chart title="Contact messages per day" isDarkMode={isDarkMode}>
        <DailyBars data={m.contact.byDay} colour="bg-emerald-500" isDarkMode={isDarkMode} />
      </Chart>
    </Group>
  );
};

CommunityGroup.propTypes = { pulse: PropTypes.object.isRequired, onOpenReports: PropTypes.func };

export default CommunityGroup;
