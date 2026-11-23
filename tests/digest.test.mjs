// Unit tests for the notification rules (supabase/functions/daily-digest/digest.ts).
// Run: node --experimental-strip-types tests/digest.test.mjs
import { buildDigest, dueToFeed, localNow, nextYearly } from '../supabase/functions/daily-digest/digest.ts';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const all = { feed_due: true, lay_soon: true, pairing_soon: true };
const A = (id, sex, species, last_feed, extra = {}) => ({ id, name: id, sex, species, status: 'Active', last_feed, ...extra });
const today = '2026-11-21';
const animals = [
  A('F1', 'Female', 'Carpet', '2026-11-14'),            // 7 days ago, female 7d: due today
  A('F2', 'Female', 'Carpet', '2026-11-18'),            // not due
  A('M1', 'Male', 'Carpet', '2026-10-31'),              // 21 days: due
  A('M2', 'Male', 'Carpet', '2026-11-10'),              // not due
  A('N1', 'Female', 'Carpet', null),                    // never fed: due
  A('S1', 'Female', 'Carpet', '2026-01-01', { status: 'Sold' }), // sold: never counted
  A('B1', 'Female', 'Bredli', '2026-11-01'),            // overdue, but Bredli paused below
  A('C1', 'Female', 'Carpet', '2026-11-10', { feed_every: 30 }), // own interval: not due
];
const seasons = [{ species: 'Bredli', pause_from: '11-01', pause_to: '12-31' }, { species: 'Carpet', pair_start: '11-24' }];
ok(dueToFeed(animals, seasons, today).map(a => a.id).sort().join() === 'F1,M1,N1', 'due: female 7d, male 21d, never fed; skips sold, paused, own interval');
let d = buildDigest(today, all, animals, seasons, []);
ok(d.find(m => m.kind === 'feed')?.body === '3 animals due to feed today: F1, M1, N1', 'feed message text');
ok(d.find(m => m.kind === 'pairing')?.body === 'Carpet pairing starts in 3 days', 'pairing start 3 days before');
ok(!buildDigest('2026-11-20', all, animals, seasons, []).some(m => m.kind === 'pairing'), 'no pairing alert 4 days before');
ok(buildDigest(today, { ...all, feed_due: false, pairing_soon: false }, animals, seasons, []).length === 0, 'toggles off: nothing sent');
ok(buildDigest(today, all, [A('X', 'Female', 'Carpet', '2026-11-20')], [], []).length === 0, 'nothing due: nothing sent');
const many = Array.from({ length: 6 }, (_, i) => A('E' + i, 'Female', 'Carpet', '2026-11-01'));
ok(buildDigest(today, all, many, [], [])[0].body === '6 animals due to feed today', 'six due: count only');
// Lay: Carpet pre-lay shed + 25 days (suggested) = lay; alert when that is 7 days away.
const pf = A('PF', 'Female', 'Carpet', '2026-11-20'), pm = A('PM', 'Male', 'Carpet', '2026-11-20');
const prelay = '2026-11-03'; // + 25 = 2026-11-28 = today + 7
d = buildDigest(today, all, [pf, pm], [], [{ female_id: 'PF', male_id: 'PM', prelay_shed: prelay, locks: [] }]);
ok(d.some(m => m.kind === 'lay' && m.body === 'PF × PM'), 'lay alert 7 days before estimated lay');
ok(!buildDigest(today, all, [pf, pm], [], [{ female_id: 'PF', male_id: 'PM', prelay_shed: '2026-11-04', locks: [] }]).some(m => m.kind === 'lay'), 'no lay alert 6 days before');
// Breeding times are fixed reference figures per species (see lib/logic.ts estimates): an old saved number doesn't move the estimate.
ok(buildDigest(today, all, [pf, pm], [{ species: 'Carpet', prelay_to_lay: 30 }], [{ female_id: 'PF', male_id: 'PM', prelay_shed: prelay, locks: [] }]).some(m => m.kind === 'lay'), 'fixed breeding times: a saved prelay_to_lay is ignored');
const bt = A('BT', 'Female', 'Blue-tongue skink', '2026-11-20'), bm = A('BM', 'Male', 'Blue-tongue skink', '2026-11-20');
// Blue-tongue: mating + 105 days (suggested) = birth. 2026-08-15 + 105 = 2026-11-28 = today + 7.
d = buildDigest(today, all, [bt, bm], [], [{ female_id: 'BT', male_id: 'BM', ovulation: '2026-08-15', locks: [] }]);
ok(d.some(m => m.kind === 'lay' && m.title === 'Birth expected in a week' && m.body === 'BT × BM'), 'live-bearer: birth alert 7 days before');
ok(nextYearly('02-29', '2027-01-01') === '2027-02-28' && nextYearly('06-01', '2026-11-21') === '2027-06-01' && nextYearly('11-21', '2026-11-21') === '2026-11-21', 'yearly date rollover');
const ln = localNow(new Date('2026-11-20T21:30:00Z'), 'Australia/Sydney');
ok(ln?.date === '2026-11-21' && ln?.hour === 8, 'local date/hour in Sydney (UTC+11 in summer)');
ok(localNow(new Date(), 'Not/AZone') === null, 'bad timezone rejected');
// Holds: in shed (until a shed is logged), and the male still in with the female.
const hb = [A('H1', 'Female', 'Carpet', '2026-11-01', { in_shed: '2026-11-18' }), A('H2', 'Female', 'Carpet', '2026-11-01'), A('H3', 'Male', 'Carpet', '2026-10-01'),
  A('H4', 'Female', 'Carpet', '2026-11-01'), A('H5', 'Female', 'Carpet', '2026-11-01', { in_shed: '2026-11-25' })];
const hp = [{ female_id: 'H2', male_id: 'H3', intro: '2026-11-10', removed: null, locks: [] }, { female_id: 'H4', male_id: 'H3', intro: '2026-10-01', removed: '2026-10-20', locks: [] }];
ok(dueToFeed(hb, [], today, hp).map(a => a.id).join() === 'H4,H5', 'in shed, and the paired female and male, are not due; removed male and a future In shed date are');
ok(dueToFeed(hb, [], today).map(a => a.id).sort().join() === 'H2,H3,H4,H5', 'without pairings only the shed hold applies');
ok(buildDigest(today, all, hb, [], hp)[0]?.body === '2 animals due to feed today: H4, H5', 'the notification leaves held animals out');
process.exit(fails ? 1 : 0);
