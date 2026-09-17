/**
 * One string standing for "the state of the editable profile fields".
 *
 * Settings compares two of these — one built from the saved profile, one from
 * the live form — to decide whether there is anything to save. They are
 * compared directly, so the two must hold the same fields in the same order,
 * and this function exists so that they cannot do otherwise.
 *
 * That is not a hypothetical tidiness argument. The two keys were built by
 * two separate array literals, the saved one ended in `isDarkMode` and the
 * draft one in `timezone` — left over from when the theme was part of the
 * Save batch — and the sixth slot therefore never matched. Save sat lit up
 * with nothing to save, from first render to last, for every user.
 *
 * Fields the form does not own have no business here. The theme is the
 * example: it saves on click now, so including it would mark the form dirty
 * over something Save cannot affect.
 */
export function buildProfileKey({
  uid,
  displayName,
  interfaceLang,
  learningDialect,
  interests,
  timezone,
} = {}) {
  return [
    uid || "",
    displayName || "",
    interfaceLang || "",
    learningDialect || "",
    (Array.isArray(interests) ? interests : []).join(","),
    timezone || "",
  ].join("|");
}
