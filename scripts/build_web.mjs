// Builds the public website: the pages in /site at the root and the web app under /app.
//   node scripts/build_web.mjs            -> ./public-site (published by .github/workflows/pages.yml)
// Where it lives comes from brand.json "siteUrl": a real address (e.g. https://clutchly.app) publishes at its root
// with a CNAME file for the custom domain; while it's still the placeholder, GitHub Pages' project address is used
// (https://eternalreptiles.github.io/clutchly), i.e. base path /clutchly.
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand.json'), 'utf8'));
const placeholder = /YOUR-SITE|example/i.test(brand.siteUrl);
const url = new URL(placeholder ? 'https://eternalreptiles.github.io/clutchly' : brand.siteUrl);
const base = url.pathname.replace(/\/+$/, '');            // '' or '/clutchly'
const out = path.join(root, 'public-site');

fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
execSync('node scripts/build_site.mjs', { cwd: root, stdio: 'inherit' });
for (const f of fs.readdirSync(path.join(root, 'site'))) if (f !== '_templates') fs.cpSync(path.join(root, 'site', f), path.join(out, f), { recursive: true });

// The app, built for the browser under <base>/app.
execSync(`npx expo export -p web --output-dir ${JSON.stringify(path.join(out, 'app'))}`, { cwd: root, stdio: 'inherit', env: { ...process.env, WEB_BASE_URL: `${base}/app` } });
// GitHub Pages serves 404.html for unknown paths, so links straight to app screens (e.g. /app/animal/...) still open the app.
fs.copyFileSync(path.join(out, 'app', 'index.html'), path.join(out, '404.html'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
if (!placeholder && !url.hostname.endsWith('github.io')) fs.writeFileSync(path.join(out, 'CNAME'), url.hostname + '\n');
console.log(`Built ${path.relative(root, out)} for ${url.origin}${base}/ (web app at ${base}/app/)`);
