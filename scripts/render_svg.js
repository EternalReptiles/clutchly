// Renders an SVG to a transparent PNG with the preinstalled Playwright Chromium (any SVG-to-PNG tool works too).
// Usage: node scripts/render_svg.js assets/source/clutchly-mark.svg assets/logo.png 2048
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [src, out, size = '2048'] = process.argv.slice(2);
  const svg = fs.readFileSync(src, 'utf8').replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +size, height: +size } });
  await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await p.screenshot({ path: out, omitBackground: true }); await b.close();
})();
