# i18n skill

Use this guidance whenever the task involves translation loading, locale switching, missing keys, Firestore-backed locale data, or user-facing strings in the UI.

## Core rule

This app does not use a static locale list. Locale data is loaded dynamically from Firestore and then synced into i18next runtime bundles.

## Required behavior

- Do not assume a fixed supportedLngs list is enough.
- Do not add a hardcoded supportedLngs allowlist unless the existing behavior is being deliberately reworked.
- Prefer the existing translation loading flow in src/i18n.js and AppContext instead of inventing a new mechanism.
- Before adding any new user-facing text, check whether the string already exists in the translation service and keys.
- Use translation keys through useTranslation() / t() instead of hardcoded text.
- Treat locale loading and missing-key backfill as part of the app's runtime architecture, not a one-off UI concern.

## Important project facts

- The app initializes i18next with en-US bundled locally and loads other locales dynamically.
- Missing keys may trigger a background translation fill from Firestore.
- Locale documents and translation content are stored via the API proxy, not directly in the frontend.
- The translation layer is part of the app state managed in AppContext.

## Do not do

- Do not create a static locale allowlist without reviewing the existing runtime flow.
- Do not hardcode strings into components when the app already has a translation pipeline.
- Do not treat locale loading as a simple UI label issue; it affects app state and runtime behavior.
- Do not add new supported languages without considering the Firestore-backed locale data flow.

## Typical checks before editing

1. Check src/i18n.js
2. Check the translation service and AppContext locale-loading path
3. Check whether the locale is already being loaded from Firestore
4. Reuse existing keys and translation plumbing before creating new strings
5. Validate with npm run lint if the change touches frontend UI code
