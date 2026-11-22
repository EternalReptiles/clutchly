// Unit tests for lib/incubation.ts. Run: npx tsc lib/incubation.ts --outDir /tmp/ic --module commonjs --target es2020 && node tests/incubation.test.js /tmp/ic
const path = require('path'); const I = require(path.resolve(process.argv[2], 'incubation.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : '  got ' + JSON.stringify(got))); if (!c) fails++; };
const R = (on_date, temp, humidity, eggs_good = null, note = null, created_at = '') => ({ id: on_date + created_at, pairing_id: 'p', on_date, temp, humidity, eggs_good, note, created_at });
const rs = [R('2026-11-10', '31.5', '75'), R('2026-11-14', 33, 80, 9), R('2026-11-12', 30.4, null, 10, 'candled'), R('2026-11-14', 31.6, 78, 8, null, 'z')];
let s = I.summary(rs, '2026-11-01', null, 31.5, '2026-11-20');
ok(s.day === 19, 'day counts from lay day (day 0)', s.day);
ok(s.readings === 4 && JSON.stringify(s.temp) === '[30.4,33]' && JSON.stringify(s.humidity) === '[75,80]', 'ranges ignore missing values and accept numbers as text', s);
ok(s.offTarget === 2, 'off target: more than 1 °C away (33 and 30.4; 31.6 is fine)', s.offTarget);
ok(s.eggsGood === 8, 'good eggs from the newest reading that has a count (same-day: last entered)', s.eggsGood);
ok(s.lastChecked === '2026-11-14' && s.sinceChecked === 6, 'last checked and days since', s);
s = I.summary(rs, '2026-11-01', '2026-11-18', null, '2026-11-20'); ok(s.day === 17 && s.offTarget === 0, 'stops counting at hatch; no target, nothing flagged', s);
s = I.summary([], null, null, 31, '2026-11-20'); ok(s.day === null && s.readings === 0 && s.temp === null && s.eggsGood === null && s.lastChecked === null, 'empty log', s);
ok(I.offTarget(R('x', 32.5, null), 31.5) === false && I.offTarget(R('x', 32.6, null), 31.5) === true, 'exactly 1 °C away is fine');
ok(I.readingText(R('x', '31.5', 75, 0, 'slug removed')) === '31.5 °C · 75% · 0 good · slug removed', 'reading text keeps a zero egg count', I.readingText(R('x', '31.5', 75, 0, 'slug removed')));
ok(I.sortReadings(rs)[0].created_at === 'z', 'newest first');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
