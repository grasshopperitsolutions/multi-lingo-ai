# Every sign-in method worth offering

**Status:** queued. Written 2026-10-01.
**Why:** only Google works. Apple, Facebook and X look ready from the outside:
- the login page has their buttons;
- `authService` opens their popups;
- Admin › Auth providers has a switch for each.

But `api/auth.ts` answers all three with **501 "not yet available"**. There is
also no way in without a social account (no email and password), and nothing
for the many students and workers whose account is a Microsoft one.

## Where things stand

| Method | Frontend | API (`/api/auth`) | Admin switch | Firebase console |
|---|---|---|---|---|
| Google | Button, popup | **Works** | On by default | Enabled |
| Apple | Button, popup | 501 | Off by default | Unknown |
| Facebook | Button, popup | 501 | Off by default | Unknown |
| X | Button, popup | 501 | Off by default | Unknown |
| Email and password | — | — | — | — |
| Email link (no password) | — | — | — | — |
| Microsoft | — | — | — | — |
| GitHub, Yahoo | — | — | — | — |
| Anonymous | Used for guests | Used for guests | — | Enabled |

Two things the table hides:

- **The API's Google branch isn't really about Google.** It verifies a Firebase
  ID token, creates the profile and mints a custom token. That works the same
  for any provider Firebase signs in. The 501s are a `switch`, not missing
  logic.
- **The Admin switch only greys a button.** The API never reads
  `appConfig/config/authProviders`, so a switch turned off in Admin doesn't
  stop anyone who calls the API directly. Today that's harmless, because the
  501 is the real gate. Once the 501s go, the switch has to become the gate.

## What to add, and what to leave out

**Finish (already wired, blocked by the API):**
- **Apple**: most iPhone users expect it, and Apple's App Store rules make it
  required the day there is an iOS app that offers other social logins.
- **Facebook**: wide reach among adult learners.
- **X**: smaller reach, but it's already wired.

**Add:**
- **Email and password**, with sign-up, forgotten password and email
  verification. The one method that needs no other company, and the one
  schools, younger users and privacy-minded people ask for. The privacy policy
  already covers it.
- **Microsoft**: work and school accounts (Office 365 / Entra ID) and
  personal Outlook ones. Fits both students and the professional tools, and
  costs nothing to register.
- **Email link (sign in without a password)**, optional. A link sent to your
  email signs you in. Friendlier than a password for occasional users; can
  ship after email and password, on the same screens.

**Deliberately left out, with reasons:**
- **Phone (SMS)**: every SMS is billed, SMS pumping fraud is common, it
  needs reCAPTCHA set up, and the privacy policy would need phone numbers
  added to §2.1. Little gain for a web app.
- **GitHub and Yahoo**: trivial to add, but almost no language learner signs
  in with them. Easy to add later through the same path if asked.
- **LinkedIn, Discord and other OIDC providers**: need the paid Identity
  Platform upgrade of Firebase Auth. LinkedIn is the only tempting one, for
  the professional tools; revisit when those grow.
- **Play Games and Game Center**: native apps only.

## Phase 0: one path for every provider (code only)

1. **`api/auth.ts`: one branch for every social method.**
   - The `google` case becomes a provider-agnostic case. The
     `apple`/`facebook`/`twitter` 501s go.
   - The provider stored on the profile comes from the verified token
     (`decodedToken.firebase.sign_in_provider`), never from the client's
     `action`, which is only a label.
   - No new endpoint; this is the endpoint the app already calls
     (`No new backend endpoints without asking`).
2. **The Admin switch becomes the gate.**
   - The API reads `appConfig/config/authProviders` (cached briefly) and
     refuses a sign-in through a provider that is switched off, with a clear
     message.
   - The login page keeps greying the button, as now. The two read the same
     documents.
   - Defaults stay: Google on, the rest off until an admin switches them on.
   - That makes each provider's launch a switch, flipped once its console
     setup is done.
3. **The same email from two providers.**
   - Firebase's default is one account per email. So someone who first signed
     in with Google and later tries Microsoft with the same address gets
     `auth/account-exists-with-different-credential`.
   - Today that would surface as an error. The plan:
     1. catch it;
     2. say which method that email already uses;
     3. sign in with that one;
     4. link the new one (`linkWithCredential`).

     The next time, either works.
   - Copy for this needs care; it's the moment people feel locked out.
4. **Popup first, redirect when the popup can't work.**
   - `signInWithPopup` fails in the in-app browsers of Instagram, Facebook
     and TikTok, and on some iOS setups.
   - Detect the failure (`auth/popup-blocked`, `auth/operation-not-supported-in-this-environment`)
     and fall back to `signInWithRedirect`, finishing the handshake with
     `getRedirectResult` on the next load.
   - One catch: on GitHub Pages, the redirect flow depends on third-party
     storage that Safari and Chrome are closing off. Firebase's documented fix
     is to serve the auth helper from our own domain (a proxy or a custom
     `authDomain`). Check it on Safari before relying on redirect.
5. **Welcome email and profile.**
   - Unchanged for social methods: the existing first-sign-in path sends it.
   - A sign-in with no email at all (some X accounts) still creates a
     profile. The welcome email is skipped, as the code already does when
     there is no email.

## Phase 1: email and password, and Microsoft

**Email and password** (no outside account needed; enable "Email/Password" in
the Firebase console):
- **On the login page:**
  - an "entrar com email" form under the social buttons, with sign-in and
    "criar conta" on the same form;
  - "esqueci-me da palavra-passe" sends Firebase's reset email.
- **Verification:**
  - a new account gets a verification email;
  - the app lets them in straight away and shows a banner until they verify,
    rather than locking them out (question 1);
  - the existing `emailVerified` field on the profile tracks it.
- **Rules:**
  - a password needs at least 8 characters;
  - Firebase's own breached-password and enumeration protection is switched
    on in the console;
  - error messages never say whether an email exists.
- **The emails:** Firebase's built-in reset and verification emails, with the
  action URL pointing back to the app, and their templates translated in the
  console. Moving them to Resend with our own copy, like every other email,
  is possible later. It's more work, because the action codes then have to be
  generated by the API.
- **Handshake:** sign in with the Firebase SDK, then the same `/api/auth`
  handshake as social methods, so profile creation and the welcome email work
  unchanged.

**Microsoft** (free Azure app registration):
- `OAuthProvider('microsoft.com')`, tenant `common`, so both personal and
  work or school accounts can sign in.
- A button, a switch in Admin, and the same path as the rest.

**In Settings › Account: "Métodos de entrada"**
- the methods linked to the account;
- link another one;
- unlink one, never the last;
- set or change a password.

This is where the linking from Phase 0 becomes visible and manageable.

## Phase 2: Apple

- **Owner setup:**
  - an Apple Developer membership (US$99 a year);
  - a Services ID with the Firebase callback;
  - a private key and the domain verified.
  - **Keys never come into this repo or the chat**: they go into the Firebase
    console.
- **Hide My Email:** Apple can give us a relay address
  (`…@privaterelay.appleid.com`). Mail to it is only delivered if the sending
  domain is registered with Apple's Private Email Relay Service. **Until it
  is, the welcome email and every reminder silently go nowhere.** Register
  the Resend sending domain there before switching Apple on.
- **Names:** Apple sends the user's name only on the first sign-in, and never
  again. The profile must keep it then; the existing backfill can't recover it
  later.
- **Button:** Apple's own design rules for the button (black or white, its
  logo, a minimum size).

## Phase 3: Facebook and X

- **Facebook:**
  - a Meta app with Facebook Login;
  - the email permission;
  - Meta's app review, and possibly business verification before it goes
    live to everyone.
  - Until then it works only for the app's own test users, which is a good
    way to check it.
- **X:**
  - a developer account and app with "request email from users" switched on.
  - Some accounts still have no email: they get a profile without one, as
    above.

## Phase 4 (optional): email link

On the email form, "enviar-me um link" as an alternative to the password,
using the same screens and the same verification state. The link must open
the app in the same browser, which Firebase handles with an email confirmation
step when it doesn't.

## Who does what

| Step | You (consoles, accounts) | Me (code) |
|---|---|---|
| 0 | — | API path, gate, linking, redirect fallback, tests |
| 1 | Enable Email/Password; translate the reset and verification email templates; register a Microsoft app and paste its ID and secret into Firebase | Email form, reset, verify banner, Microsoft button, Settings › Métodos de entrada |
| 2 | Apple membership, Services ID, key; register the Resend domain with Apple's relay | Apple-specific name capture, button style |
| 3 | Meta app and review; X developer app | Nothing beyond switching them on |
| 4 | Add the app's domain to Firebase's authorised domains for links | Email link option |

## Verification

- **Unit:**
  - the API path, for each provider id from the token;
  - a switched-off provider refused;
  - a missing email handled;
  - the linking flow on `account-exists-with-different-credential`;
  - the redirect fallback.
- **In the browser:**
  - each method end to end on a test account, in both themes;
  - the email form at phone width;
  - the linking prompt;
  - Settings › Métodos de entrada;
  - the popup to redirect fallback in an in-app browser (Instagram on a
    phone is the classic failure).
- **Real devices:** Safari on an iPhone for Apple and for the redirect flow,
  where third-party storage rules bite first.

## Risks

- **Locking people out by email.** Linking is the risky part: get the copy or
  the flow wrong and someone who signed up with Google can't get in with
  Microsoft and doesn't know why. Phase 0 tests it before any new provider is
  switched on.
- **Silent mail loss with Apple.** Covered above. It's the one failure that
  shows up nowhere, so it's a checklist item, not a hope.
- **Review delays.** Meta's review can take weeks. Nothing else depends on it,
  so it sits last.

## Questions to settle before building

1. **Email and password: let people in before they verify their email?**
   Recommended: yes, with a banner until they do. A verification wall at
   sign-up is where most email sign-ups are lost.
2. **Microsoft: personal and work or school accounts, or only one?**
   Recommended: both (tenant `common`).
3. **Do you have, or want, an Apple Developer membership?** Apple can't ship
   without it.
4. **Facebook and X: worth the review work for this audience?** If not, the
   buttons and switches can be removed instead of left greyed out forever.
5. **Email link (Phase 4): wanted at all, or is email and password enough?**
