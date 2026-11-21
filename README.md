# Clutchly
Expo + Supabase app for reptile feeding, shed and breeding tracking. Each user signs up and sees only their own collection (enforced by Postgres row-level security).

## Setup
1. Create a free project at supabase.com. In SQL editor, run `supabase/schema.sql`. (Databases created from an older schema: run the files in `supabase/migrations/` in order.)
2. Put your project URL and anon/publishable key in `lib/config.ts` (already set for this project). They are public by design; never use the service_role / secret key. A `.env` file (see `.env.example`) overrides them, e.g. to point at a test project.
3. `npm install && npx expo start`, then scan the QR code with Expo Go. Notifications and purchases need a development
   build (`npx eas build --profile development`).

## Species
`lib/species.ts` lists every species a breeder can pick (pythons, dragons, monitors, geckos, skinks, turtles, Other), with
Latin names, aliases (used by CSV import and search) and typical days from ovulation/mating to lay, pre-lay shed to lay,
and lay to hatch. The Season tab suggests the middle of each range; each user can set their own numbers per species.

## Species templates and onboarding
`species_templates` (migration 008) holds shared starting values per species: feed intervals, feeding pause, pairing
start, and days from pre-lay shed / ovulation to lay and from lay to hatch. Every signed-in user can read it; nobody can
change it from the app (edit it with a new migration or in the Supabase dashboard). Seeded for Carpet, Bredli, Diamond
and Antaresia. Dates are for the southern hemisphere; northern-hemisphere users get them shifted by six months
(`lib/templates.ts`, tested in `tests/templates.test.js`).

New users see a one-time Welcome screen (`app/welcome.tsx`): hemisphere (guessed from the phone's timezone) and the
species they keep, with a preview; "Use these starting values" copies the templates into their own season settings
(never overwriting a routine they already have), or they can skip. The Season tab offers "Use starting values" per
species later. Users' edits are private and never change the templates. The app name comes from `brand.json`.

## Legal pages, support site and data export
- `/site` is a static support site (support, privacy policy, terms of use) built from `site/_templates` by
  `node scripts/build_site.mjs` (fills in the app name from `brand.json`). They are drafts for an Australian business with
  `[BRACKETED]` placeholders and must be reviewed by a lawyer. Host `/site` anywhere static and set `siteUrl` in `brand.json`.
- The app links to them from the login screen and Account > Help and legal.
- Account > Download my data (free for everyone) saves a JSON file of all the user's records, settings and 7-day photo
  links (`lib/exportData.ts`; share sheet on phones via `expo-sharing`, a download on the web).

## Free and Pro
- Free: up to `free_animals` owned animals (table `app_limits`, currently 10; animals marked Sold don't count, and
  marking one back as owned is checked against the limit too) with every record-keeping feature and data export.
  Pro (RevenueCat entitlement `pro`): unlimited animals, photos and morning notifications.
- Pro status lives in `subscriptions`, written **only** by the `revenuecat-webhook` Edge Function (checks the
  `REVENUECAT_WEBHOOK_AUTH` secret; ignores out-of-order events; optional `REVENUECAT_SECRET_API_KEY` to re-read status
  from RevenueCat). Users can read their own row and nothing else. Migration `009_subscriptions.sql`.
- Enforced by the database, not the app: a trigger refuses animal number 11 for non-Pro users (with a per-user lock so
  parallel adds can't slip through); adding photos requires Pro in both the table policy and the storage policy; the
  daily-digest function only notifies Pro users. Nothing is ever deleted or locked when Pro ends. Complimentary Pro (your own and the reviewer
  account) is set by hand with `last_event_type = 'MANUAL'` (see migration 010) and is never changed by store events.
- App: `lib/purchases.ts` (react-native-purchases; logs in with the Supabase user id), `app/paywall.tsx` (yearly
  subscription with price and renewal terms, restore, redeem a code, terms and privacy links), `lib/plan.ts`.
  Keys and product ids are in `brand.json`; until real keys are added, purchases are switched off.
- Tests: `tests/revenuecat.test.mjs` (webhook rules), `tests/plans.test.mjs` (free vs Pro vs lapsed, against Supabase),
  `tests/plans.e2e.js` (limits in the app). Store setup steps: `docs/LAUNCH_CHECKLIST.md`.

## Logo, icon and splash
The mark (a python brooding a clutch of eggs, engraved style) is drawn by code, so it can be tweaked and regenerated:
1. `python3 scripts/draw_logo.py` writes `assets/source/clutchly-mark.svg`
2. `node scripts/render_svg.js assets/source/clutchly-mark.svg assets/logo.png 2048` (or export the SVG to PNG with any tool)
3. `python3 scripts/make_icons.py` writes the app icon, Android adaptive icon, splash image, favicon and login logo into `assets/`

To use a different logo, put it at `assets/logo.png` (black on white or transparent) and run step 3.

## Offline mode
Breeding rooms often have poor signal, so the app works from a copy of the user's data kept on the phone (`lib/store.ts`):
- Every screen reads the local copy. Changes are applied on the phone straight away and queued; the queue is sent in order
  as soon as the server can be reached (retried every 15 seconds while offline, and whenever the app is reopened).
- New rows get their ids on the phone (UUIDs), so a retried insert can never create a duplicate.
- Each sync downloads only rows the server received since the last one (`synced_at`) and deletions made on other
  devices (`deleted_rows`). Migration `005_offline_sync.sql`.
- The header shows "Offline · N to sync" while changes are waiting, and "Sync problem" if the server rejected a change
  (that change is undone on the phone and the data reloaded). Signing out with unsynced changes asks first.
- Adding photos and changing account settings need a connection.

**Conflict rule: last write wins.** Every row records when it was last edited (`updated_at`, set on the device that made
the edit, even offline). When two devices change the same row, the edit made later wins, even if it reaches the server
first; an older edit that arrives later is ignored (enforced by the `clutchly_touch` trigger). If one device deletes a row
that another edits offline, the delete wins. Changes to different rows never conflict.

## Photos
Each animal can have several photos (`lib/photos.ts`, `lib/PhotoGallery.tsx`), chosen from the library or taken with the
camera, resized to at most 1200 px on the long edge and saved as JPEG (about 150-250 KB) before upload.
- Files go to the private `animal-photos` bucket at `<user id>/<animal id>/<photo id>.jpg`. Storage policies only let a user
  read or write inside the folder named after their own user id; images are shown through signed URLs (valid 1 hour).
  The bucket only accepts JPEG, up to 5 MB.
- `animal_photos` lists each animal's photos (one is the cover, shown on the Animals list) and syncs like other data.
- Deleting a photo, an animal or an account queues the files in `photo_cleanup`; the hourly `daily-digest` function
  removes them from Storage (photos deleted while online are also removed straight away). Migration `006_photos.sql`.
- Adding photos needs a connection; viewing needs one unless the image was already loaded.

## Growth chart and history
The animal screen shows a growth chart (weight over time, drawn with `react-native-svg`; tap or drag to read a point), the
average number of days between sheds, and the share of feeds refused in the last 90 days, plus the five most recent
entries. "Full history" filters by type (feeds, sheds, weights) and date range; tap any entry to edit its date, result,
food, weight or note, or to delete it. The calculations are in `lib/history.ts` (unit-tested in `tests/history.test.js`).

## Hatchlings
Once a pairing has a hatch date (live-bearers: a birth date), "Create hatchlings" asks for the clutch size, fertile eggs,
how many to add and an ID pattern, previews the names, then adds them as animals: species from the mother, sex Unknown,
hatch date, linked to both parents and to the pairing. The pairing's clutch and fertile counts are updated.
- ID pattern placeholders: `{YYYY}` / `{YY}` hatch year, `{###}` running number (one # per digit), `{MOTHER}` `{FATHER}`.
  Numbering continues after the highest existing ID with that pattern and year; the pattern is remembered per user.
- Animal screens show parents and offspring. Deleting a parent keeps the offspring and clears the link.
- Sex can now be Female, Male or Unknown (fed on the female interval; not offered for pairings).
- Migration `007_hatchlings.sql` (parent/pairing links, checked to belong to the same user).

## Push notifications
Each morning (at the hour and timezone the user picks in Account > Notifications) the `daily-digest` Edge Function sends
one notification per alert type, only when something is due: feeds due today (skipping Sold animals and species in their
feeding pause), lays/births expected in 7 days, and a species' pairing start in 3 days. Nothing is sent on quiet days.

How it fits together:
- `device_tokens` (one row per phone; `register_device_token()` moves a token if the phone signs in to another account)
  and `notification_settings`, both with row-level security. Migration `003_notifications.sql`.
- `supabase/functions/daily-digest/`: `digest.ts` holds the rules (unit-tested in `tests/digest.test.mjs`); `shared/` is a
  copy of `lib/logic.ts` and `lib/species.ts` made by `node scripts/sync_function_shared.mjs` (re-run it after changing those).
- pg_cron calls the function at 1 minute past every hour (`004_notification_cron.sql`); the function only sends to users
  whose chosen hour has just started locally, once per day. The call carries a shared secret (`CRON_SECRET` on the function,
  `clutchly_cron_secret` in the database vault). The service role key exists only inside the function.
- Tokens are removed on sign out, when the user turns notifications off for a phone, when Expo reports a phone as gone,
  and with the account.

The app asks for permission only when the user taps "Turn on" (Account, or a one-time card on Today once they have animals).

Remote notifications do not work in Expo Go. To try them you need a development build:
1. `npx eas init` (links the app to an Expo project and writes its projectId into app.json).
2. Android: create a Firebase project, add the Android app `com.eternalreptiles.clutchly`, put `google-services.json` in the
   project and set `"googleServicesFile": "./google-services.json"` under `android` in app.json, then upload an FCM V1
   service-account key with `npx eas credentials`. iOS: needs an Apple Developer account; EAS sets up the push key.
3. `npx eas build --profile development --platform android` (or ios), install it, sign in, Account > Turn on notifications.

Deploying the function after changes: `supabase functions deploy daily-digest --no-verify-jwt` (Supabase CLI), or the
Management API. Test it with `CRON_SECRET=... node --env-file=.env tests/digest.function.test.mjs`.

## Password reset emails
In Supabase, **Authentication > URL Configuration > Redirect URLs**, add:
- `clutchly://reset-password` (the installed app)
- `exp://**` (only while testing in Expo Go)

Without these, the link in the email opens the Site URL instead of the app.
Supabase's built-in email sender only delivers to your own team's addresses and a few emails an hour; set up your own SMTP (see below) before other people use the app.

## Tests
- `npm run typecheck`
- `node --experimental-strip-types tests/digest.test.mjs` and `tests/revenuecat.test.mjs`: notification and webhook rules. `tests/templates.test.js`: hemisphere shifts.
- `RC_AUTH=... CRON_SECRET=... node --env-file=.env tests/plans.test.mjs`: free vs Pro vs lapsed, enforced by the database. Tests that need Pro use `tests/makePro.cjs` (sends the webhook a sandbox purchase). `tests/history.test.js` and `tests/hatchlings.test.js`: stats and ID patterns (see the comment at the top of each).
- `node scripts/sync_function_shared.mjs --check`: the Edge Function's copy of the rules is up to date.
- `node --env-file=.env tests/rls.test.mjs`: signs up two throwaway accounts and checks that neither can read or change the other's data (needs "Confirm email" off in Supabase while it runs).
- `tests/ui.e2e.js`, `tests/import.e2e.js`, `tests/reset.e2e.js`, `tests/species.e2e.js`, `tests/offline.e2e.js`, `tests/photos.e2e.js`, `tests/history.e2e.js`, `tests/hatchlings.e2e.js`, `tests/onboarding.e2e.js`, `tests/export.e2e.js` and `tests/plans.e2e.js`: click through the web build with Playwright; see the comment at the top of each file.

## Store readiness
- `brand.json` holds the name, identifiers, version, site address, support email and RevenueCat keys; `app.config.ts`
  builds the Expo config from it (permission text, no-encryption declaration, iOS privacy manifest, blocked Android
  permissions). iPad support is off for version 1.
- `eas.json`: `development` (dev client, internal), `preview` (internal test builds, Android APK) and `production`
  (store builds; build numbers increase automatically).
- `scripts/check_release.mjs` lists placeholders that must be replaced before a store build.
- Reviewer account: `scripts/seed_demo.mjs`. Store text, privacy answers and screenshot plan: `/store`.
  Launch steps: `docs/LAUNCH_CHECKLIST.md`; production database: `docs/SUPABASE_PRODUCTION.md`.

## Not built yet
Nothing from the plan; see the checklist below.

See `docs/LAUNCH_CHECKLIST.md` for everything that needs doing outside the code.
