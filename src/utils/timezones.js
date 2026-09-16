/**
 * timezones.js
 *
 * The IANA zone list, for the Settings picker that decides when a reminder
 * arrives.
 *
 * The list comes from `Intl.supportedValuesOf("timeZone")` rather than a table
 * in this repo, for the same reason the TTS accent names come from
 * `Intl.DisplayNames`: a hardcoded list goes stale every time the tz database
 * renames or splits a zone, and nobody notices until someone's reminders come
 * an hour early. It is ~418 entries, browser-maintained, and free.
 *
 * `supportedValuesOf` is ES2022. It is guarded because a browser without it
 * should show the one zone we can always determine — the detected one — rather
 * than an empty dropdown that looks broken.
 *
 * Options are labelled with the current UTC offset ("(UTC+01:00) Europe/Lisbon")
 * because a bare zone id is only recognisable if you already know which one you
 * are in, and sorted by offset so the list reads west to east instead of
 * alphabetically by continent.
 *
 * **The offset is computed for today.** A zone that observes DST will label
 * differently in July than in January. That is correct — it is what the clock
 * says now — but it means the labels are not stable strings to test against.
 */

/** The browser's best guess. Always available, and right for almost everyone. */
export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Minutes this zone is currently offset from UTC. 0 if the zone is unusable. */
export function offsetMinutes(zone, now = new Date()) {
  try {
    // `en-US` with `timeZoneName: "longOffset"` yields "GMT+01:00"; parsing
    // that is more reliable across engines than the two-Date-diff trick, which
    // rounds badly for the zones that are offset by 30 or 45 minutes.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(now);

    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0; // "GMT" with no offset is UTC itself.

    const [, sign, hours, minutes] = match;
    const total = Number(hours) * 60 + Number(minutes);
    return sign === "-" ? -total : total;
  } catch {
    return 0;
  }
}

/** "(UTC+05:30)" for the given offset in minutes. */
function formatOffset(minutes) {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `(UTC${sign}${hh}:${mm})`;
}

/**
 * Every zone as a NeoDropdown option, sorted by current offset then by name.
 *
 * @returns {{value: string, label: string}[]}
 */
export function timezoneOptions() {
  let zones;
  try {
    zones = typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  } catch {
    zones = [];
  }

  // Never return an empty list: a dropdown with nothing in it reads as broken,
  // and the detected zone is the one value we can always produce.
  const detected = detectTimezone();
  if (!zones.length) zones = [detected];
  else if (!zones.includes(detected)) zones = [...zones, detected];

  return zones
    .map((zone) => ({ zone, offset: offsetMinutes(zone) }))
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone))
    .map(({ zone, offset }) => ({
      value: zone,
      label: `${formatOffset(offset)} ${zone.replace(/_/g, " ")}`,
    }));
}
