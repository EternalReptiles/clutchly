# Clutchly
Expo + Supabase app for reptile feeding, shed and breeding tracking. Each user signs up and sees only their own collection (enforced by Postgres row-level security).

## Setup
1. Create a free project at supabase.com. In SQL editor, run `supabase/schema.sql`.
2. Copy `.env.example` to `.env` with your project URL and anon key (Settings > API). Never use the service_role key in the app.
3. `npm install && npx expo start`, then scan the QR code with Expo Go.
4. Add `assets/icon.png` (1024x1024, from your logo).

## Before the stores
- `bundleIdentifier` / `package` are `com.eternalreptiles.clutchly`. They cannot change once the app is published in the stores.
- Supabase Auth: configure email templates, enable email confirmation, set up a real SMTP sender (Resend, Postmark).
- Required: privacy policy URL, support URL, in-app account deletion (included). Apple: $99/yr developer account; Google Play: $25 once.
- Build and submit: `npm i -g eas-cli && eas build -p ios && eas submit -p ios` (same for android).
- If you add "Sign in with Google/Facebook", Apple requires also offering Sign in with Apple.
- Check the "Clutchly" name is free in both stores and not trademarked in your markets before launch.

## Not built yet
Offline mode, push notifications for due feeds, photos, CSV import/export, bulk add, hatchling IDs, subscriptions (RevenueCat), password reset screen.
