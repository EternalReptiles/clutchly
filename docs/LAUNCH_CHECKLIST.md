# Launch checklist

Everything here needs you to act outside the code, in the order you need to do it. Each step says why. For anything
code-related, ask me.

## 1. Business basics
1. **ABN.** You need one to sell in the stores as a business and to fill in the legal pages. If Eternal Reptiles already
   has one, use it.
2. **Decide who publishes:** you as an individual, or your business. A business account shows the business name in the
   stores and needs a **D-U-N-S number** (free from Dun & Bradstreet, takes about a week). Google's organisation accounts
   also skip the 12-tester / 14-day closed test that new personal accounts must run.
3. **GST:** Apple and Google collect and pay Australian GST on sales to Australians for you. If you're registered for GST,
   ask your accountant how to report the income (store payouts arrive net of their commission).
4. **Apply for the developer accounts now** (details in step 6): Apple Developer Program (US$99/year) and Google Play
   Console (US$25 once). Approval, D-U-N-S numbers and Apple's paid-apps agreement can each take days.
5. **Name check.** "Clutchly" is a working name. Search the App Store, Google Play, the IP Australia trade mark search
   (search.ipaustralia.gov.au) and a domain registrar before you commit. If you change it, edit `brand.json` (`name`)
   before the first release. The IDs (`com.eternalreptiles.clutchly`) can't change after release.

## 2. Supabase production project
Follow `docs/SUPABASE_PRODUCTION.md`: Sydney region, Pro plan (backups), migrations, email sender, redirect URLs, rate
limits, functions and secrets. *Why:* real users' data shouldn't live in the test project, and the free plan has no backups.

## 3. Legal pages and support site

1. **Fill in the placeholders.** Open `site/_templates/privacy.html`, `terms.html` and `index.html` and replace every
   `[BRACKETED]` item: business name, ABN, support email, postal address, dates, backup retention, liability cap.
   Then run `node scripts/build_site.mjs` to regenerate the pages in `/site`.
   *Why:* the stores and the Privacy Act require you to say who you are and how to contact you.
2. **Have a lawyer review all three pages.** They are drafts written for an Australian business (Privacy Act 1988,
   Australian Consumer Law) but they are not legal advice. Remove the yellow "DRAFT" box only after the review.
3. **Host the `/site` folder** on Netlify, Vercel or GitHub Pages (free). Netlify: drag the `site` folder onto
   app.netlify.com/drop. Then put the address in `brand.json` as `siteUrl` (for example `https://clutchly.netlify.app`).
   *Why:* Apple and Google require a working privacy policy URL, and the app links to these pages.
4. **Support email.** Set up the address you used in the legal pages (for example support@yourdomain) and put it in
   `brand.json` (`supportEmail`).

## 4. Expo account and builds
1. Create a free account at expo.dev (you already have one), then in the project folder run `npx eas login` and
   `npx eas init`. *Why:* links the app to your Expo account so EAS can build it, and gives it the project ID push
   notifications need.
2. `npx eas build --profile development --platform android` makes a test app for your phone (the first build asks to
   create a signing key; say yes and let EAS keep it). iPhone builds need the Apple account from step 6A.
3. Push notifications on Android need a Firebase project: firebase.google.com > add project > add Android app with
   package `com.eternalreptiles.clutchly` > download `google-services.json` into the project and set
   `"googleServicesFile": "./google-services.json"` under `android` in app.json, then upload an FCM V1 service-account
   key with `npx eas credentials`. iPhone push keys are set up by EAS automatically.

## 5. Test on real phones
Install the development build, sign in, and try: notifications (Account > Turn on), the camera and photo library,
offline mode (airplane mode, log feeds, turn it off again), and a sandbox purchase (after step 6). Tell me anything odd.

## 6. Subscriptions (Apple, Google, RevenueCat)

The app sells one thing: **Clutchly Pro**, a yearly auto-renewing subscription (A$59.95/year). A second, hidden product,
a **lifetime unlock**, is never shown in the app; you give it away with store codes. Both unlock the same RevenueCat
entitlement, `pro`. Product IDs used in the code (`brand.json`): `clutchly_pro_yearly` and `clutchly_pro_lifetime`.
If you change them, change them everywhere below and in `brand.json`.

### A. Apple (App Store Connect, appstoreconnect.apple.com)
1. **Join the Apple Developer Program** (US$99/year) as an individual or as your business (a business needs a D-U-N-S
   number, free, takes a few days). *Why:* required to publish on the App Store.
2. **Agreements, Tax, and Banking:** accept the *Paid Apps* agreement, add your Australian bank account, and complete the
   tax forms (Australian businesses fill in the US W-8BEN form; Apple collects and pays Australian GST for you).
   *Why:* Apple can't sell subscriptions or pay you until this is done. Approval can take a few days.
3. **Enrol in the App Store Small Business Program** (developer.apple.com/app-store/small-business-program). *Why:* cuts
   Apple's commission from 30% to 15% while you earn under US$1 million a year.
4. **Create the app:** My Apps > + > New App, bundle ID `com.eternalreptiles.clutchly`, name from `brand.json`.
5. **Create the subscription:** your app > Monetization > Subscriptions > create a group "Pro" > add a subscription
   with Product ID `clutchly_pro_yearly`, duration 1 year, price A$59.95 (Apple only offers fixed price points; if
   A$59.95 isn't one, pick the nearest, e.g. A$59.99, and tell me so the store text matches). Add a display name
   ("Clutchly Pro") and description ("Unlimited animals, photos and notifications").
6. **Create the lifetime unlock:** Monetization > In-App Purchases > + > Non-Consumable, Product ID
   `clutchly_pro_lifetime`, any price (e.g. A$149.99; nobody pays it, people get it with a code). In its review notes
   write: "Not sold in the app; only redeemed with offer codes given to selected people."
7. **Create an In-App Purchase key:** Users and Access > Integrations > In-App Purchase > generate a key, download the
   `.p8` file (you can only download it once). *Why:* RevenueCat needs it to check purchases.
8. **Codes for the people you choose:** Monetization > Offer Codes (for one-time purchases on recent iOS versions; Apple
   also has limited Promo Codes). Create codes for `clutchly_pro_lifetime` and send them. They redeem them in the app
   (Pro screen > Redeem a code) or the App Store.

### B. Google (Play Console, play.google.com/console)
1. **Create a developer account** (US$25 once). Personal accounts created recently must run a closed test with at least
   12 testers for 14 days before going public; an organisation account (needs a D-U-N-S number) skips that.
2. **Set up a payments profile** (Setup > Payments profile): bank account and tax details. *Why:* needed to sell.
3. **Create the app** with package name `com.eternalreptiles.clutchly`, and upload a first build to *Internal testing*
   (products can only be created after a build exists). I can make that build with EAS once you've run `eas init`.
4. **Create the subscription:** Monetize > Products > Subscriptions > Create, Product ID `clutchly_pro_yearly`, add a base
   plan (ID `yearly`, auto-renewing, 1 year, A$59.95; let Google convert other countries).
5. **Create the lifetime unlock:** Monetize > Products > In-app products > Create, Product ID `clutchly_pro_lifetime`.
6. **Give RevenueCat access:** follow RevenueCat's "Google Play service credentials" guide: create a Google Cloud service
   account, grant it access in Play Console (Users and permissions), download its JSON key. Also turn on Real-time
   developer notifications to RevenueCat's Pub/Sub topic (RevenueCat shows the topic name).
7. **Codes:** Monetize > Promo codes > create codes for `clutchly_pro_lifetime`. People redeem them in the Play Store
   (Pro screen > Redeem a code opens it).

### C. RevenueCat (app.revenuecat.com, free until US$2,500/month revenue)
1. **Create a project** "Clutchly". Add an **App Store app** (bundle ID, upload the `.p8` key from A7 with its key ID and
   issuer ID) and a **Play Store app** (package name, upload the service account JSON from B6).
2. **Products:** import `clutchly_pro_yearly` and `clutchly_pro_lifetime` from both stores.
3. **Entitlement:** create one called exactly `pro` and attach all four products (yearly and lifetime, Apple and Google).
4. **Offering:** the `default` offering gets one package, **Annual** (`$rc_annual`), containing the two yearly products.
   Don't add the lifetime product to the offering (it stays hidden; codes unlock it).
5. **API keys:** Project settings > API keys. Copy the **public** Apple key (`appl_…`) and Google key (`goog_…`) into
   `brand.json` (`revenuecat.iosApiKey` / `androidApiKey`). These are meant to be in the app. Never put the *secret* key
   in the app.
6. **Webhook:** Integrations > Webhooks > add. URL: `https://<your-project>.supabase.co/functions/v1/revenuecat-webhook`.
   Authorization header: make up a long random value, e.g. run `openssl rand -base64 32` and use `Bearer <that value>`.
   Put the exact same text in Supabase (Edge Functions > Secrets) as `REVENUECAT_WEBHOOK_AUTH`.
   *Why:* this is how the server learns who has Pro. The app never decides it.
7. **Recommended:** create a RevenueCat **secret** API key (v1) and add it in Supabase secrets as
   `REVENUECAT_SECRET_API_KEY`. The webhook then asks RevenueCat for each user's current status instead of relying on
   single events.
8. **Test:** use a sandbox tester (App Store Connect > Users and Access > Sandbox) or a Play licence tester, buy Pro in a
   development build, and check Account shows "Clutchly Pro". RevenueCat's webhook page shows each delivery.

## 7. Store listings
- Text, categories, age-rating answers and review notes: `store/listing.md`. Privacy forms: `store/app-privacy.md`.
  Screenshots: `store/screenshots.md`.
- Put the reviewer account's email and password in App Store Connect (App Review Information) and Play Console
  (App access). I've given you the credentials separately; they are not in the repo.

## 8. Release
1. Run `node scripts/check_release.mjs`. It lists any placeholders still in the app or site (RevenueCat keys,
   site address, support email, legal `[BRACKETS]` and DRAFT notices, the test Supabase project). Fix them all.
2. Bump `version` in `brand.json` for each release (build numbers are automatic).
3. `npx eas build --profile production --platform all`, then `npx eas submit -p ios` and `-p android` (or upload in
   the consoles). Google: start with Internal testing, then Closed testing (12 testers for 14 days if you have a new
   personal account), then Production.
4. Submit for review. Apple usually takes 1-3 days. I won't submit anything for you.
