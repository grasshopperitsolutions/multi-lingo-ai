/**
 * dialCodes.js
 *
 * Country calling codes for the tutor phone field.
 *
 * Every territory with an E.164 code, not a curated shortlist. An earlier
 * version shipped 27 countries chosen around Portuguese: fine for the first
 * tutor, wrong for a directory meant to carry any language, because a tutor
 * whose country is missing simply cannot publish a reachable number.
 *
 * Only `iso` and `dial` live here. Country *names* come from
 * `Intl.DisplayNames`, so the picker reads in whatever interface language the
 * user has chosen — including languages this app has never been translated
 * into — and no name list has to be maintained or re-translated here. That is
 * also why the file stays small despite covering ~240 territories.
 *
 * Dial codes are not unique: +1 covers the whole North American Numbering
 * Plan, +7 Russia and Kazakhstan, +590 Guadeloupe and its neighbours. `iso` is
 * therefore the key, and `primary` marks which territory a shared code should
 * resolve back to when a stored number is split apart again.
 */

/** @typedef {{ iso: string, dial: string, primary?: boolean }} DialCode */

/** @type {ReadonlyArray<DialCode>} */
export const DIAL_CODES = Object.freeze([
  // ── +1, North American Numbering Plan ──
  { iso: "US", dial: "+1", primary: true },
  { iso: "CA", dial: "+1" },
  { iso: "AG", dial: "+1" }, { iso: "AI", dial: "+1" }, { iso: "AS", dial: "+1" },
  { iso: "BB", dial: "+1" }, { iso: "BM", dial: "+1" }, { iso: "BS", dial: "+1" },
  { iso: "DM", dial: "+1" }, { iso: "DO", dial: "+1" }, { iso: "GD", dial: "+1" },
  { iso: "GU", dial: "+1" }, { iso: "JM", dial: "+1" }, { iso: "KN", dial: "+1" },
  { iso: "KY", dial: "+1" }, { iso: "LC", dial: "+1" }, { iso: "MP", dial: "+1" },
  { iso: "MS", dial: "+1" }, { iso: "PR", dial: "+1" }, { iso: "SX", dial: "+1" },
  { iso: "TC", dial: "+1" }, { iso: "TT", dial: "+1" }, { iso: "VC", dial: "+1" },
  { iso: "VG", dial: "+1" }, { iso: "VI", dial: "+1" },

  // ── +7 ──
  { iso: "RU", dial: "+7", primary: true },
  { iso: "KZ", dial: "+7" },

  // ── two-digit codes ──
  { iso: "EG", dial: "+20" }, { iso: "ZA", dial: "+27" }, { iso: "GR", dial: "+30" },
  { iso: "NL", dial: "+31" }, { iso: "BE", dial: "+32" }, { iso: "FR", dial: "+33" },
  { iso: "ES", dial: "+34" }, { iso: "HU", dial: "+36" },
  { iso: "IT", dial: "+39", primary: true }, { iso: "VA", dial: "+39" },
  { iso: "RO", dial: "+40" }, { iso: "CH", dial: "+41" }, { iso: "AT", dial: "+43" },
  { iso: "GB", dial: "+44", primary: true },
  { iso: "GG", dial: "+44" }, { iso: "IM", dial: "+44" }, { iso: "JE", dial: "+44" },
  { iso: "DK", dial: "+45" }, { iso: "SE", dial: "+46" },
  { iso: "NO", dial: "+47", primary: true }, { iso: "SJ", dial: "+47" },
  { iso: "PL", dial: "+48" }, { iso: "DE", dial: "+49" },
  { iso: "PE", dial: "+51" }, { iso: "MX", dial: "+52" }, { iso: "CU", dial: "+53" },
  { iso: "AR", dial: "+54" }, { iso: "BR", dial: "+55" }, { iso: "CL", dial: "+56" },
  { iso: "CO", dial: "+57" }, { iso: "VE", dial: "+58" },
  { iso: "MY", dial: "+60" },
  { iso: "AU", dial: "+61", primary: true }, { iso: "CC", dial: "+61" }, { iso: "CX", dial: "+61" },
  { iso: "ID", dial: "+62" }, { iso: "PH", dial: "+63" }, { iso: "NZ", dial: "+64" },
  { iso: "SG", dial: "+65" }, { iso: "TH", dial: "+66" },
  { iso: "JP", dial: "+81" }, { iso: "KR", dial: "+82" }, { iso: "VN", dial: "+84" },
  { iso: "CN", dial: "+86" },
  { iso: "TR", dial: "+90" }, { iso: "IN", dial: "+91" }, { iso: "PK", dial: "+92" },
  { iso: "AF", dial: "+93" }, { iso: "LK", dial: "+94" }, { iso: "MM", dial: "+95" },
  { iso: "IR", dial: "+98" },

  // ── +2xx, Africa ──
  { iso: "SS", dial: "+211" },
  { iso: "MA", dial: "+212", primary: true }, { iso: "EH", dial: "+212" },
  { iso: "DZ", dial: "+213" }, { iso: "TN", dial: "+216" }, { iso: "LY", dial: "+218" },
  { iso: "GM", dial: "+220" }, { iso: "SN", dial: "+221" }, { iso: "MR", dial: "+222" },
  { iso: "ML", dial: "+223" }, { iso: "GN", dial: "+224" }, { iso: "CI", dial: "+225" },
  { iso: "BF", dial: "+226" }, { iso: "NE", dial: "+227" }, { iso: "TG", dial: "+228" },
  { iso: "BJ", dial: "+229" }, { iso: "MU", dial: "+230" }, { iso: "LR", dial: "+231" },
  { iso: "SL", dial: "+232" }, { iso: "GH", dial: "+233" }, { iso: "NG", dial: "+234" },
  { iso: "TD", dial: "+235" }, { iso: "CF", dial: "+236" }, { iso: "CM", dial: "+237" },
  { iso: "CV", dial: "+238" }, { iso: "ST", dial: "+239" }, { iso: "GQ", dial: "+240" },
  { iso: "GA", dial: "+241" }, { iso: "CG", dial: "+242" }, { iso: "CD", dial: "+243" },
  { iso: "AO", dial: "+244" }, { iso: "GW", dial: "+245" }, { iso: "IO", dial: "+246" },
  { iso: "SC", dial: "+248" }, { iso: "SD", dial: "+249" }, { iso: "RW", dial: "+250" },
  { iso: "ET", dial: "+251" }, { iso: "SO", dial: "+252" }, { iso: "DJ", dial: "+253" },
  { iso: "KE", dial: "+254" }, { iso: "TZ", dial: "+255" }, { iso: "UG", dial: "+256" },
  { iso: "BI", dial: "+257" }, { iso: "MZ", dial: "+258" }, { iso: "ZM", dial: "+260" },
  { iso: "MG", dial: "+261" },
  { iso: "RE", dial: "+262", primary: true }, { iso: "YT", dial: "+262" },
  { iso: "ZW", dial: "+263" }, { iso: "NA", dial: "+264" }, { iso: "MW", dial: "+265" },
  { iso: "LS", dial: "+266" }, { iso: "BW", dial: "+267" }, { iso: "SZ", dial: "+268" },
  { iso: "KM", dial: "+269" }, { iso: "SH", dial: "+290" }, { iso: "ER", dial: "+291" },
  { iso: "AW", dial: "+297" }, { iso: "FO", dial: "+298" }, { iso: "GL", dial: "+299" },

  // ── +3xx / +4xx, Europe ──
  { iso: "GI", dial: "+350" }, { iso: "PT", dial: "+351" }, { iso: "LU", dial: "+352" },
  { iso: "IE", dial: "+353" }, { iso: "IS", dial: "+354" }, { iso: "AL", dial: "+355" },
  { iso: "MT", dial: "+356" }, { iso: "CY", dial: "+357" },
  { iso: "FI", dial: "+358", primary: true }, { iso: "AX", dial: "+358" },
  { iso: "BG", dial: "+359" }, { iso: "LT", dial: "+370" }, { iso: "LV", dial: "+371" },
  { iso: "EE", dial: "+372" }, { iso: "MD", dial: "+373" }, { iso: "AM", dial: "+374" },
  { iso: "BY", dial: "+375" }, { iso: "AD", dial: "+376" }, { iso: "MC", dial: "+377" },
  { iso: "SM", dial: "+378" }, { iso: "UA", dial: "+380" }, { iso: "RS", dial: "+381" },
  { iso: "ME", dial: "+382" }, { iso: "HR", dial: "+385" }, { iso: "SI", dial: "+386" },
  { iso: "BA", dial: "+387" }, { iso: "MK", dial: "+389" }, { iso: "CZ", dial: "+420" },
  { iso: "SK", dial: "+421" }, { iso: "LI", dial: "+423" },

  // ── +5xx, the Americas ──
  { iso: "FK", dial: "+500" }, { iso: "BZ", dial: "+501" }, { iso: "GT", dial: "+502" },
  { iso: "SV", dial: "+503" }, { iso: "HN", dial: "+504" }, { iso: "NI", dial: "+505" },
  { iso: "CR", dial: "+506" }, { iso: "PA", dial: "+507" }, { iso: "PM", dial: "+508" },
  { iso: "HT", dial: "+509" },
  { iso: "GP", dial: "+590", primary: true }, { iso: "BL", dial: "+590" }, { iso: "MF", dial: "+590" },
  { iso: "BO", dial: "+591" }, { iso: "GY", dial: "+592" }, { iso: "EC", dial: "+593" },
  { iso: "GF", dial: "+594" }, { iso: "PY", dial: "+595" }, { iso: "MQ", dial: "+596" },
  { iso: "SR", dial: "+597" }, { iso: "UY", dial: "+598" },
  { iso: "CW", dial: "+599", primary: true }, { iso: "BQ", dial: "+599" },

  // ── +6xx, Oceania and South-East Asia ──
  { iso: "TL", dial: "+670" }, { iso: "NF", dial: "+672" }, { iso: "BN", dial: "+673" },
  { iso: "NR", dial: "+674" }, { iso: "PG", dial: "+675" }, { iso: "TO", dial: "+676" },
  { iso: "SB", dial: "+677" }, { iso: "VU", dial: "+678" }, { iso: "FJ", dial: "+679" },
  { iso: "PW", dial: "+680" }, { iso: "WF", dial: "+681" }, { iso: "CK", dial: "+682" },
  { iso: "NU", dial: "+683" }, { iso: "WS", dial: "+685" }, { iso: "KI", dial: "+686" },
  { iso: "NC", dial: "+687" }, { iso: "TV", dial: "+688" }, { iso: "PF", dial: "+689" },
  { iso: "TK", dial: "+690" }, { iso: "FM", dial: "+691" }, { iso: "MH", dial: "+692" },

  // ── +8xx, East Asia ──
  { iso: "KP", dial: "+850" }, { iso: "HK", dial: "+852" }, { iso: "MO", dial: "+853" },
  { iso: "KH", dial: "+855" }, { iso: "LA", dial: "+856" }, { iso: "BD", dial: "+880" },
  { iso: "TW", dial: "+886" },

  // ── +9xx, Middle East and Central Asia ──
  { iso: "MV", dial: "+960" }, { iso: "LB", dial: "+961" }, { iso: "JO", dial: "+962" },
  { iso: "SY", dial: "+963" }, { iso: "IQ", dial: "+964" }, { iso: "KW", dial: "+965" },
  { iso: "SA", dial: "+966" }, { iso: "YE", dial: "+967" }, { iso: "OM", dial: "+968" },
  { iso: "PS", dial: "+970" }, { iso: "AE", dial: "+971" }, { iso: "IL", dial: "+972" },
  { iso: "BH", dial: "+973" }, { iso: "QA", dial: "+974" }, { iso: "BT", dial: "+975" },
  { iso: "MN", dial: "+976" }, { iso: "NP", dial: "+977" }, { iso: "TJ", dial: "+992" },
  { iso: "TM", dial: "+993" }, { iso: "AZ", dial: "+994" }, { iso: "GE", dial: "+995" },
  { iso: "KG", dial: "+996" }, { iso: "UZ", dial: "+998" },
]);

/** The country a new tutor gets before they touch the picker. */
export const DEFAULT_DIAL_ISO = "PT";

/**
 * Offered at the top of the picker, above the full alphabetical list.
 *
 * Not a claim about who matters — a shortcut past 240 entries for the people
 * most likely to be here first. The rest of the world is one scroll away, not
 * missing.
 */
export const SUGGESTED_ISOS = Object.freeze([
  "PT", "BR", "AO", "MZ", "CV", "GW", "ST", "TL",
]);

/**
 * Localized country name, e.g. "Alemanha" in pt-PT and "ドイツ" in ja.
 *
 * Falls back to the ISO code rather than an English name: a bare "DE" beside
 * "+49" is still usable, and carrying a hardcoded English list would defeat
 * the point of asking the platform in the first place. Old engines without
 * Intl.DisplayNames take the same path.
 *
 * @param {string} iso
 * @param {string} [locale]
 * @returns {string}
 */
export function countryName(iso, locale) {
  try {
    return new Intl.DisplayNames([locale || "pt-PT"], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/**
 * The picker's options, localized and sorted for one interface language.
 *
 * Sorted with `Intl.Collator`, not `Array.sort`'s default: the default is
 * code-point order, which puts "Ãfrica do Sul" and "Áustria" in the wrong
 * place in every language with accents — including this app's base locale.
 *
 * @param {string} [locale]
 * @returns {{ suggested: Array<{iso: string, dial: string, name: string}>,
 *             rest: Array<{iso: string, dial: string, name: string}> }}
 */
export function dialCodeOptions(locale) {
  const collator = new Intl.Collator(locale || "pt-PT");
  const withNames = DIAL_CODES.map((entry) => ({
    iso: entry.iso,
    dial: entry.dial,
    name: countryName(entry.iso, locale),
  }));

  const suggested = SUGGESTED_ISOS.map((iso) => withNames.find((c) => c.iso === iso)).filter(
    Boolean,
  );

  const rest = withNames.slice().sort((a, b) => collator.compare(a.name, b.name));

  return { suggested, rest };
}

/**
 * Split a stored phone number into a country and a national number.
 *
 * Longest dial code first, so +351 is not read as +3 followed by "51". Among
 * territories sharing a code the `primary` one wins, which is why splitting
 * "+1..." gives US rather than whichever NANP island happens to sort first.
 *
 * A number with no recognised prefix keeps its digits and falls back to the
 * default country rather than being silently rewritten — an unparseable value
 * is usually one somebody typed by hand, and dropping it loses their contact
 * details.
 *
 * @param {string} [stored] - e.g. "+351912345678"
 * @returns {{ iso: string, national: string }}
 */
export function splitPhone(stored) {
  const value = String(stored ?? "").replace(/\s+/g, "");
  if (!value) return { iso: DEFAULT_DIAL_ISO, national: "" };

  const candidates = DIAL_CODES.filter((entry) => value.startsWith(entry.dial));
  if (candidates.length === 0) {
    return { iso: DEFAULT_DIAL_ISO, national: value.replace(/^\+/, "") };
  }

  const longest = Math.max(...candidates.map((c) => c.dial.length));
  const tied = candidates.filter((c) => c.dial.length === longest);
  const match = tied.find((c) => c.primary) ?? tied[0];

  return { iso: match.iso, national: value.slice(match.dial.length) };
}

/**
 * Build the stored value from a country and a national number.
 *
 * Returns "" when there is no national number, so an untouched picker never
 * saves a bare "+351" — a dial code on its own is not a contact detail, and
 * the card would render a phone row nobody can call.
 *
 * @param {string} iso
 * @param {string} national
 * @returns {string}
 */
export function joinPhone(iso, national) {
  const digits = String(national ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  const entry = DIAL_CODES.find((c) => c.iso === iso);
  return `${entry?.dial ?? ""}${digits}`;
}
