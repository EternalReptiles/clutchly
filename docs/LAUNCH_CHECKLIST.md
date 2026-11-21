# Launch checklist

Everything here needs you to act outside the code. Work through it in order. (This file is completed in the store
readiness step; sections below are added as each part is built.)

## Legal pages and support site

1. **Fill in the placeholders.** Open `site/_templates/privacy.html`, `terms.html` and `index.html` and replace every
   `[BRACKETED]` item: business name, ABN, support email, postal address, dates, backup retention, liability cap.
   Then run `node scripts/build_site.mjs` to regenerate the pages in `/site`.
   *Why:* the stores and the Privacy Act require you to say who you are and how to contact you.
2. **Have a lawyer review all three pages.** They are drafts written for an Australian business (Privacy Act 1988,
   Australian Consumer Law) but they are not legal advice. Remove the yellow "DRAFT" box only after the review.
3. **Host the `/site` folder** on Netlify, Vercel or GitHub Pages (free). Netlify: drag the `site` folder onto
   app.netlify.com/drop. Then put the address in `brand.json` as `siteUrl` (for example `https://clutchly.netlify.app`).
   *Why:* Apple and Google require a working privacy policy URL, and the app links to these pages.
