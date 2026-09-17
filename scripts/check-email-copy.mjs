#!/usr/bin/env node
/**
 * Warns when the API repo's copy of the email and reminder strings has fallen
 * behind this one.
 *
 * These strings exist twice on purpose — the two repos deploy separately and
 * cannot import each other, and the API needs copy that still sends when
 * Firestore is unreachable. This file is the source; the API's
 * lib/email-copy.base.ts is generated from it by `npm run sync:email-copy`
 * over there.
 *
 * **Advisory here, blocking there**, and the asymmetry is deliberate. Two
 * repos cannot merge atomically, so a check that blocks on both sides
 * guarantees one repo's master is red between the two merges. This repo is
 * the source and is allowed to move first; the API is what has to catch up,
 * so that is where the hard gate lives (plus a daily scheduled run, so a
 * change landing here is noticed even if nobody opens a PR there).
 *
 * Reads the sibling checkout when there is one, so it is instant offline and
 * during local work. The remote fetch is unauthenticated because the API repo
 * is public; if it goes private this needs a read-only token in the header
 * and a secret wired into ci.yml.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, "../src/locales/pt/translation.json");

const SIBLING = resolve(HERE, "../../../proxies/multi-lingo-ai-api/lib/email-copy.base.ts");
const REMOTE =
  "https://raw.githubusercontent.com/grasshopperitsolutions/multi-lingo-ai-api/master/lib/email-copy.base.ts";

/** The API's generated file, from the sibling checkout or from GitHub. */
async function readGenerated() {
  if (existsSync(SIBLING)) {
    return { where: "sibling checkout", text: readFileSync(SIBLING, "utf8") };
  }
  const response = await fetch(REMOTE);
  if (!response.ok) {
    return { where: REMOTE, text: null, status: response.status };
  }
  return { where: REMOTE, text: await response.text() };
}

/**
 * The strings the API's generated file currently holds.
 *
 * Anchored on the export rather than on brace positions, because the file's
 * header comment contains `{{name}}`-style placeholders. The format is a
 * contract with the generator in the API repo, not a guess about TypeScript.
 */
function parseGenerated(text) {
  const match = text.match(/export const EMAIL_COPY_BASE = ([\s\S]*);\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

const flatten = (node, prefix = "") =>
  Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]]
  );

const email = JSON.parse(readFileSync(SOURCE, "utf8")).email;
const { where, text, status } = await readGenerated();

if (!text) {
  console.warn(`[check-email-copy] could not read the API's generated file (HTTP ${status}). Skipping.`);
} else {
  const generated = parseGenerated(text);
  if (!generated) {
    console.error(`[check-email-copy] the API's generated file could not be parsed — it may have been hand-edited.`);
    process.exitCode = 1;
  } else {
    const here = Object.fromEntries(flatten(email));
    const there = Object.fromEntries(flatten(generated));
    const keys = [...new Set([...Object.keys(here), ...Object.keys(there)])].sort();
    const differing = keys.filter((key) => here[key] !== there[key]);

    if (differing.length === 0) {
      console.log(`[check-email-copy] the API (${where}) is in step with this repo.`);
    } else {
      console.error(`[check-email-copy] the API's copy is BEHIND this repo on ${differing.length} string(s):\n`);
      for (const key of differing) {
        if (!(key in there)) console.error(`  + ${key}  (not in the API yet)`);
        else if (!(key in here)) console.error(`  - ${key}  (still in the API, gone from here)`);
        else {
          console.error(`  ~ ${key}`);
          console.error(`      here: ${JSON.stringify(here[key])}`);
          console.error(`      API:  ${JSON.stringify(there[key])}`);
        }
      }
      console.error(`\nIn the API repo: \`npm run sync:email-copy\`, then commit and deploy.`);
      console.error(`Until then the API sends the old wording. Its own CI blocks on this.`);
      process.exitCode = 1;
    }
  }
}
