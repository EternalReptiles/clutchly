// Unit tests for lib/hatchlings.ts. Run: npx tsc lib/hatchlings.ts --outDir /tmp/hl --module commonjs --target es2020 && node tests/hatchlings.test.js /tmp/hl
const h = require(require('path').resolve(process.argv[2], 'hatchlings.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : ' got ' + JSON.stringify(got))); if (!c) fails++; };
let r = h.hatchlingNames('ER-{YYYY}-{###}', '2027-01-15', 'ER001', 'ER002', 3, ['ER001', 'ER002']);
ok(r.join() === 'ER-2027-001,ER-2027-002,ER-2027-003', 'pattern with year and 3-digit number', r);
r = h.hatchlingNames('ER-{YYYY}-{###}', '2027-02-01', 'A', 'B', 2, ['ER-2027-001', 'er-2027-007', 'ER-2026-010']);
ok(r.join() === 'ER-2027-008,ER-2027-009', 'continues after the highest number that year (case-insensitive), ignores other years', r);
r = h.hatchlingNames('{MOTHER}x{FATHER}-{YY}-{#}', '2027-03-01', 'Ruby', 'Jag', 2, []);
ok(r.join() === 'RubyxJag-27-1,RubyxJag-27-2', 'parents names, 2-digit year, unpadded number', r);
r = h.hatchlingNames('CLUTCH', '2027-03-01', 'A', 'B', 2, ['CLUTCH-01']);
ok(r.join() === 'CLUTCH-02,CLUTCH-03', 'pattern without a number gets one', r);
r = h.hatchlingNames('', '2027-03-01', 'A', 'B', 1, []);
ok(r.join() === '2027-001', 'empty pattern uses the default', r);
r = h.hatchlingNames('H.{##}(x)', '2027-03-01', 'A', 'B', 2, ['H.05(x)']);
ok(r.join() === 'H.06(x),H.07(x)', 'regex characters in the pattern are literal', r);
process.exit(fails ? 1 : 0);
