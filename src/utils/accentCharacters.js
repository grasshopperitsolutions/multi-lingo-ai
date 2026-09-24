/**
 * Characters that are hard to type on a keyboard from somewhere else, per base
 * language. A language that is not listed simply gets no bar: its learners
 * either have the keyboard already or the script needs an IME, which a row of
 * buttons would not replace.
 */
const ACCENTS = {
  pt: ["á", "à", "â", "ã", "ç", "é", "ê", "í", "ó", "ô", "õ", "ú"],
  es: ["á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"],
  fr: ["à", "â", "æ", "ç", "é", "è", "ê", "ë", "î", "ï", "ô", "œ", "ù", "û", "ü"],
  it: ["à", "è", "é", "ì", "ò", "ù"],
  de: ["ä", "ö", "ü", "ß"],
  ca: ["à", "ç", "é", "è", "í", "ï", "ó", "ò", "ú", "ü", "·"],
  ro: ["ă", "â", "î", "ș", "ț"],
  pl: ["ą", "ć", "ę", "ł", "ń", "ó", "ś", "ź", "ż"],
  nl: ["é", "ë", "ï", "ö"],
  sv: ["å", "ä", "ö"],
  tr: ["ç", "ğ", "ı", "İ", "ö", "ş", "ü"],
};

/** @param {string} dialect */
export function accentsFor(dialect) {
  return ACCENTS[String(dialect ?? "").split("-")[0].toLowerCase()] ?? [];
}
