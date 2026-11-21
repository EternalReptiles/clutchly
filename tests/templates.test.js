// Unit tests for lib/templates.ts. Run: npx tsc lib/templates.ts --outDir /tmp/tp --module commonjs --target es2020 && node tests/templates.test.js /tmp/tp
const t = require(require('path').resolve(process.argv[2], 'templates.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : ' got ' + JSON.stringify(got))); if (!c) fails++; };
ok(t.shiftMD('06-01', 'south') === '06-01', 'south unchanged');
ok(t.shiftMD('06-01', 'north') === '12-01', 'June -> December');
ok(t.shiftMD('09-01', 'north') === '03-01', 'September -> March (wraps the year)');
ok(t.shiftMD('08-31', 'north') === '02-28', '31 August -> 28 February (clamped)');
ok(t.shiftMD('05-31', 'north') === '11-30', '31 May -> 30 November (clamped)');
ok(t.shiftMD(null, 'north') === null, 'blank stays blank');
const carpet = { species: 'Carpet', male_every: 21, female_every: 7, pause_from: '05-01', pause_to: '05-31', pair_start: '06-01', prelay_to_lay: 25, ovul_to_lay: 49, lay_to_hatch: 55, notes: 'x' };
const n = t.seasonFromTemplate(carpet, 'north');
ok(n.pause_from === '11-01' && n.pause_to === '11-30' && n.pair_start === '12-01' && n.male_every === 21 && n.prelay_to_lay === 25 && !('notes' in n), 'northern carpet season');
ok(t.guessHemisphere('Australia/Brisbane') === 'south' && t.guessHemisphere('Europe/London') === 'north' && t.guessHemisphere('America/New_York') === 'north' && t.guessHemisphere('Pacific/Auckland') === 'south', 'hemisphere guess from timezone');
process.exit(fails ? 1 : 0);
