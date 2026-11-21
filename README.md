# Clutchly
Expo + Supabase app for reptile feeding, shed and breeding tracking. Each user signs up and sees only their own collection (enforced by Postgres row-level security).

## Setup
1. Create a free project at supabase.com. In SQL editor, run `supabase/schema.sql`. (Databases created from an older schema: run the files in `supabase/migrations/` in order.)
2. Put your project URL and anon/publishable key in `lib/config.ts` (already set for this project). They are public by design; never use the service_role / secret key. A `.env` file (see `.env.example`) overrides them, e.g. to point at a test project.
3. `npm install && npx expo start`, then scan the QR code with Expo Go.

## Species
`lib/species.ts` lists every species a breeder can pick (pythons, dragons, monitors, geckos, skinks, turtles, Other), with
Latin names, aliases (used by CSV import and search) and typical days from ovulation/mating to lay, pre-lay shed to lay,
and lay to hatch. The Season tab suggests the middle of each range; each user can set their own numbers per species.

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
- Photos (Phase 2.3) and account settings need a connection.

**Conflict rule: last write wins.** Every row records when it was last edited (`updated_at`, set on the device that made
the edit, even offline). When two devices change the same row, the edit made later wins, even if it reaches the server
first; an older edit that arrives later is ignored (enforced by the `clutchly_touch` trigger). If one device deletes a row
that another edits offline, the delete wins. Changes to different rows never conflict.

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
- `node --experimental-strip-types tests/digest.test.mjs`: notification rules.
- `node scripts/sync_function_shared.mjs --check`: the Edge Function's copy of the rules is up to date.
- `node --env-file=.env tests/rls.test.mjs`: signs up two throwaway accounts and checks that neither can read or change the other's data (needs "Confirm email" off in Supabase while it runs).
- `tests/ui.e2e.js`, `tests/import.e2e.js`, `tests/reset.e2e.js`, `tests/species.e2e.js` and `tests/offline.e2e.js`: click through the web build with Playwright; see the comment at the top of each file.

## Before the stores
- `bundleIdentifier` / `package` are `com.eternalreptiles.clutchly`. They cannot change once the app is published in the stores.
- Supabase Auth: configure email templates, enable email confirmation, set up a real SMTP sender (Resend, Postmark).
- Required: privacy policy URL, support URL, in-app account deletion (included). Apple: $99/yr developer account; Google Play: $25 once.
- Build and submit: `npm i -g eas-cli && eas build -p ios && eas submit -p ios` (same for android).
- If you add "Sign in with Google/Facebook", Apple requires also offering Sign in with Apple.
- Check the "Clutchly" name is free in both stores and not trademarked in your markets before launch.

## Not built yet
Photos, CSV export, hatchling IDs, subscriptions (RevenueCat).
