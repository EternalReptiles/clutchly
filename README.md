# Clutchly
Expo + Supabase app for reptile feeding, shed and breeding tracking. Each user signs up and sees only their own collection (enforced by Postgres row-level security).

## Setup
1. Create a free project at supabase.com. In SQL editor, run `supabase/schema.sql`.
2. Copy `.env.example` to `.env` with your project URL and anon key (Settings > API). Never use the service_role key in the app.
3. `npm install && npx expo start`, then scan the QR code with Expo Go.

## Logo, icon and splash
The mark (a python brooding a clutch of eggs, engraved style) is drawn by code, so it can be tweaked and regenerated:
1. `python3 scripts/draw_logo.py` writes `assets/source/clutchly-mark.svg`
2. `node scripts/render_svg.js assets/source/clutchly-mark.svg assets/logo.png 2048` (or export the SVG to PNG with any tool)
3. `python3 scripts/make_icons.py` writes the app icon, Android adaptive icon, splash image, favicon and login logo into `assets/`

To use a different logo, put it at `assets/logo.png` (black on white or transparent) and run step 3.

## Password reset emails
In Supabase, **Authentication > URL Configuration > Redirect URLs**, add:
- `clutchly://reset-password` (the installed app)
- `exp://**` (only while testing in Expo Go)

Without these, the link in the email opens the Site URL instead of the app.
Supabase's built-in email sender only delivers to your own team's addresses and a few emails an hour; set up your own SMTP (see below) before other people use the app.

## Tests
- `npm run typecheck`
- `node --env-file=.env tests/rls.test.mjs`: signs up two throwaway accounts and checks that neither can read or change the other's data (needs "Confirm email" off in Supabase while it runs).
- `tests/ui.e2e.js`, `tests/import.e2e.js` and `tests/reset.e2e.js`: click through the web build with Playwright; see the comment at the top of each file.

## Before the stores
- `bundleIdentifier` / `package` are `com.eternalreptiles.clutchly`. They cannot change once the app is published in the stores.
- Supabase Auth: configure email templates, enable email confirmation, set up a real SMTP sender (Resend, Postmark).
- Required: privacy policy URL, support URL, in-app account deletion (included). Apple: $99/yr developer account; Google Play: $25 once.
- Build and submit: `npm i -g eas-cli && eas build -p ios && eas submit -p ios` (same for android).
- If you add "Sign in with Google/Facebook", Apple requires also offering Sign in with Apple.
- Check the "Clutchly" name is free in both stores and not trademarked in your markets before launch.

## Not built yet
Offline mode, push notifications for due feeds, photos, CSV export, hatchling IDs, subscriptions (RevenueCat).
