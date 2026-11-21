// Pre-release check: fails if placeholders are still in the app config, legal pages or build settings.
// Run before every store build:  node scripts/check_release.mjs
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const brand = JSON.parse(read('brand.json')); const problems = [];
const check = (bad, msg) => { if (bad) problems.push(msg); };
check(/REPLACE_ME/.test(brand.revenuecat.iosApiKey + brand.revenuecat.androidApiKey), 'brand.json: RevenueCat public API keys are placeholders');
check(/YOUR-SITE|example/i.test(brand.siteUrl), 'brand.json: siteUrl is a placeholder (host /site and put its address here)');
check(/\[|\]/.test(brand.supportEmail), 'brand.json: supportEmail is a placeholder');
for (const f of ['index.html', 'privacy.html', 'terms.html']) {
  const html = read(`site/${f}`);
  const brackets = [...new Set(html.match(/\[[A-Z][A-Z0-9 ,.'"/()-]+\]/g) ?? [])];
  check(brackets.length > 0, `site/${f}: placeholders ${brackets.join(', ')}`);
  check(/class="draft"/.test(html), `site/${f}: still marked DRAFT (remove after the lawyer's review)`);
}
check(/xtjoypcgzfotjzskmggw/.test(read('lib/config.ts')), 'lib/config.ts: points at the TEST Supabase project (use production)');
check(/\[APP STORE CONNECT APP ID\]/.test(read('eas.json')), 'eas.json: submit.production.ios.ascAppId is a placeholder');
check(!JSON.parse(read('app.json')).expo.extra?.eas?.projectId, 'app.json: no EAS projectId yet (run npx eas init)');
if (problems.length) { console.log(`Not ready to release (${problems.length}):\n- ` + problems.join('\n- ')); process.exit(1); }
console.log('Release check passed.');
