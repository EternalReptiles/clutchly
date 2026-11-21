# Supabase production checklist

**Current production project:** `oybgqvhuromskcwcjyft` ("clutchly", Sydney ap-southeast-2), set in `lib/config.ts`.
Moved there from the old Tokyo project `xtjoypcgzfotjzskmggw` ("Reptile Tracking") on 2026-11-21, as set out in
`docs/MIGRATE_TO_SYDNEY.md`. Steps 1, 2 and 4 below are done, and so are the reviewer and owner accounts (copied with
their passwords). Still to do: Pro plan, custom SMTP, then the branded email templates (Supabase refuses custom
templates on the built-in sender), "Confirm email" on with minimum password length 8 (left as on the old project
for now), and the RevenueCat webhook URL.
Auth URL configuration in use: Site URL `https://clutchly.com.au/app`; redirect URLs
`https://clutchly.com.au/app/reset-password`, `clutchly://reset-password`, `exp://**` (remove that one at launch).

To test without touching real users, use a separate test project and point `.env` at it. The release check
(`scripts/check_release.mjs`) fails if `lib/config.ts` still points at the old Tokyo project.

## 1. Create the project
- supabase.com > New project. **Region: Sydney (ap-southeast-2)** so Australian users' data stays in Australia (the
  privacy policy then needs no overseas-storage wording for the database; update `[SUPABASE REGION]` there).
- Use a strong database password and keep it in a password manager.
- **Plan: Pro (US$25/month).** The free plan has **no backups** and pauses after a week without activity. Pro has daily
  backups kept 7 days (add Point-in-Time Recovery later if you want restore-to-any-minute). Set the privacy policy's
  backup retention to match.

## 2. Database (SQL Editor, in this order)
1. `supabase/schema.sql`
2. Every file in `supabase/migrations/`, in number order (`001` ... `014`). Each is safe to run again.
3. In `004_notification_cron.sql`, change the project URL to the production one **before** running it, and first run:
   `select vault.create_secret('<a long random value>', 'clutchly_cron_secret');`
   (Generate the value with `openssl rand -base64 32`. Use the same value for `CRON_SECRET` in step 4.)
4. Check: Database > Tables shows row-level security **enabled** on every table (the migrations do this).

## 3. Authentication
- **Sign In / Providers > Email:** turn **Confirm email** ON. Minimum password length 8.
- **SMTP** (Authentication > Emails > SMTP): your own sender (for example Resend), sender name "Clutchly", from a
  domain you own. The built-in sender only reaches team members and a few emails an hour.
- **Email templates:** edit "Confirm signup" and "Reset password" to say Clutchly; keep `{{ .ConfirmationURL }}`.
- **URL Configuration:** Site URL = your support site (`siteUrl`). Redirect URLs: `clutchly://reset-password`.
- **Rate limits:** raise "emails sent per hour" to suit (for example 100) once SMTP is set; keep sign-in/sign-up limits on.
- **Attack protection:** turn on leaked-password protection (Pro plan) and, if spam sign-ups appear, CAPTCHA.

## 4. Edge Functions and secrets
- Deploy `daily-digest` and `revenuecat-webhook`, both with **JWT verification off** (they check their own secrets):
  `supabase functions deploy daily-digest --no-verify-jwt` and the same for `revenuecat-webhook` (Supabase CLI,
  `supabase link --project-ref <ref>` first), or ask me to deploy them with an access token.
- Edge Functions > Secrets: `CRON_SECRET` (same as the vault secret), `REVENUECAT_WEBHOOK_AUTH` (the exact Authorization
  value you set in RevenueCat, e.g. `Bearer …`), and optionally `REVENUECAT_SECRET_API_KEY`.
- The service role key stays inside Supabase. Never put it in the app, the repo or `brand.json`.

## 5. Point the app at production
- `lib/config.ts`: the production Project URL and **publishable (anon) key** (Project Settings > API Keys).
- RevenueCat webhook URL: the production `.../functions/v1/revenuecat-webhook`.
- Build a new version with EAS.

## 6. Reviewer account
Run `scripts/seed_demo.mjs` against production (see the comment at the top of the file): create the account, confirm
its email in Authentication > Users, grant Pro with the SQL in the script's header, then run the script again.

## 7. Your own account
Sign up in the app with your own email, then make it Pro for good (Supabase SQL Editor):
`insert into subscriptions (user_id, entitlement, active, expires_at, product_id, store, last_event_type, last_event_at) select id, 'pro', true, null, 'owner_account', 'PROMOTIONAL', 'MANUAL', now() from auth.users where email = '<your email>' on conflict (user_id) do update set active = true, expires_at = null, last_event_type = 'MANUAL';`

## 8. Before launch
- Delete any test users from production (Authentication > Users).
- Turn on email alerts for project usage (Organization > Billing) so you know before hitting limits.
- Storage: the `animal-photos` bucket is created by migration 006 and must stay **private**.
