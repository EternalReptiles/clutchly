# Move Clutchly to the Sydney database

Hand-off plan for a new Claude session. The owner has created a new Supabase project in **Sydney
(ap-southeast-2)** and wants all data moved there from the current project (`xtjoypcgzfotjzskmggw`, "Reptile
Tracking", Tokyo ap-northeast-1). Nothing is live for customers yet; the owner and the App Review demo account
are the only real users. Keep RLS on everything, never put the service_role key in the app.

## Before starting (owner)
- A Supabase access token is saved as the environment's network secret for `api.supabase.com` (the session
  sends any `Authorization: Bearer x` and the proxy swaps in the real token). If calls return "Invalid access
  token", the saved token is stale: ask the owner to update it in the environment settings.
- The owner pauses logging in the app during the move.

## Steps (Claude)
1. **Find the projects:** `GET https://api.supabase.com/v1/projects`. New = region `ap-southeast-2`. Ask to
   allow `<new-ref>.supabase.co` in the environment's network (update_environment) for the tests.
2. **Schema:** run `supabase/schema.sql`, then `supabase/migrations/001`–`014` in order, via
   `POST /v1/projects/{ref}/database/query`. Check: every table in `public` has RLS on; seeds present
   (species_templates 4 rows, gene_library 27, morph_combos 4, app_limits free_animals = 10).
3. **Extensions/cron:** migration 004 needs `pg_cron`, `pg_net`, vault. Make a new random cron secret, store it
   with `vault.create_secret(<secret>, 'clutchly_cron_secret')` and as Edge Function secret `CRON_SECRET`.
   Point the cron job's URL at the new project's `daily-digest` function.
4. **Edge Functions:** deploy `daily-digest` and `revenuecat-webhook` (Management API deploy, `verify_jwt:false`,
   as before; `node scripts/sync_function_shared.mjs --check` first). Secrets: `CRON_SECRET`,
   `REVENUECAT_WEBHOOK_AUTH` (new random value; owner enters it in RevenueCat later),
   `REVENUECAT_SECRET_API_KEY` (only once RevenueCat exists). SUPABASE_URL / SERVICE_ROLE_KEY are automatic.
5. **Storage:** private bucket `animal-photos` and its policies come from migration 006/009; verify.
6. **Auth settings:** copy from the old project (`GET/PATCH /v1/projects/{ref}/config/auth`): confirm-email
   setting, password rules, site URL `https://clutchly.com.au/app`, redirect URLs
   (`https://clutchly.com.au/app/reset-password`, `clutchly://reset-password`, `exp://**`), email templates from
   `supabase/email-templates/` with subjects "Reset your Clutchly password" / "Confirm your Clutchly account".
   Custom SMTP is not set up yet.
7. **Data:** copy real users only (skip test accounts `clutchly.*@gmail.com`): `auth.users` and
   `auth.identities` rows as-is (password hashes and ids kept, so passwords and links still work), then public
   tables in dependency order (animals, events, pairings, season_settings, notification_settings, device_tokens,
   animal_photos, user_genes, animal_genes, subscriptions incl. the owner's MANUAL Pro row), keeping ids and
   timestamps. Copy photo files bucket-to-bucket with the service keys (`GET /v1/projects/{ref}/api-keys`). Compare
   row counts per table and user afterwards.
8. **App:** put the new URL and publishable key in `lib/config.ts`; update `scripts/check_release.mjs` (old ref =
   test project), `.env` locally, docs/SUPABASE_PRODUCTION.md. Privacy policy (`site/_templates/privacy.html`):
   "Tokyo, Japan" -> "Sydney, Australia"; rebuild with `node scripts/build_site.mjs`.
9. **Test against the new project:** `tests/rls.test.mjs`, `plans.test.mjs`, `digest.function.test.mjs`,
   `revenuecat.test.mjs`, and the browser suites (see README). Sign in as the owner via the web build and check the
   animals are there.
10. **Commit and push** (website and web app redeploy themselves). Tell the owner: start Expo Go from a fresh
    download (or build TestFlight now), keep the old project paused for a couple of weeks as a backup, then delete
    it; delete the access token; set the RevenueCat webhook URL to the new project when RevenueCat is set up.

## Done (2026-11-21)
New project: `oybgqvhuromskcwcjyft` ("clutchly", Sydney). Old: `xtjoypcgzfotjzskmggw` (Tokyo, keep paused as backup).
- Schema + migrations 001–014 applied (004 with the Sydney URL); 16 tables, all RLS on; policies, functions,
  triggers, grants and seeds identical to the old project. Bucket `animal-photos` private with its 4 policies.
- New cron secret in the vault and as `CRON_SECRET`; hourly job points at the Sydney `daily-digest`.
- `daily-digest` and `revenuecat-webhook` deployed (`verify_jwt:false`). New `REVENUECAT_WEBHOOK_AUTH`
  (`Bearer …`; the owner gets the value privately and enters it in RevenueCat later).
- Auth: confirm email off (as before), site URL and redirect URLs set. Custom SMTP (Resend, Japan region) added by
  the owner, then the branded templates and subjects applied and the email limit raised to 100 an hour.
- Data: owner and review account copied (users, identities, all public tables incl. `deleted_rows`, MANUAL Pro
  rows); counts and row hashes match the old project. No photo files existed. Test accounts not copied.
- App, `.env`, privacy policy (Sydney, Australia) and docs/SUPABASE_PRODUCTION.md updated.
- Tests against Sydney all passed: rls (75), plans (42), digest.function (17), revenuecat, digest, and every browser
  suite (ui, import, reset, species, offline, history, hatchlings, onboarding, export, plans, genes, photos). Owner and
  review account signed in and see all their animals. Leftover throwaway test accounts deleted; only the two real
  accounts remain. Tests create `clutchly.*@gmail.com` accounts: delete leftovers after any future run here.
