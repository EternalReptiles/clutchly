// Unit tests for lib/overview.ts. Run: npx tsc lib/overview.ts --outDir /tmp/ov --module commonjs --target es2020 && node tests/overview.test.js /tmp/ov
const path = require('path'); const O = require(path.resolve(process.argv[2], 'overview.js')); const L = require(path.resolve(process.argv[2], 'logic.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : '  got ' + JSON.stringify(got))); if (!c) fails++; };
const t = L.today(), d = n => L.addDays(t, n);
const A = (id, sex, last_feed, x = {}) => ({ id, name: id, species: 'Carpet', sex, status: 'Active', last_feed, ...x });
const animals = [A('F1', 'Female', d(-9)), A('F2', 'Female', d(-7)), A('F3', 'Female', d(-4)), A('M1', 'Male', d(-20)), A('S1', 'Female', d(-30), { status: 'Sold' })];
const seasons = [{ species: 'Carpet', female_every: 7, male_every: 21, pair_start: d(20).slice(5) }];
const ev = (animal_id, kind, on_date, ok = null) => ({ animal_id, kind, on_date, ok });
const events = [ev('F3', 'feed', d(-12), false), ev('F3', 'feed', d(-8), false), ev('F3', 'feed', d(-4), false), ev('F1', 'feed', d(-9), true),
  ev('F2', 'shed', d(-2)), ev('F2', 'weight', d(-1)), ev('F2', 'feed', d(-7), true), ev('F1', 'feed', d(-20), false)];
const pairings = [{ id: 'p1', female_id: 'F1', male_id: 'M1', laid: d(-50), locks: [] }, { id: 'p2', female_id: 'F2', male_id: 'M1', prelay_shed: d(-24), locks: [] },
  { id: 'p3', female_id: 'F3', male_id: 'M1', laid: d(-60), locks: [] }];
const o = O.overview(animals, events, pairings, seasons, t);
ok(o.dueNow.map(x => x.a.name).join() === 'F1,F2', 'due now: overdue first, sold animals left out', o.dueNow.map(x => x.a.name));
ok(o.days.length === 7 && o.days[2].items.some(i => i.kind === 'feed' && i.animals.map(a => a.name).join() === 'F3'), 'F3 due in 3 days', o.days[2]);
ok(o.days[0].items.some(i => i.kind === 'feed' && i.animals[0].name === 'M1'), 'M1 (21 days) due tomorrow');
const lay = o.days.flatMap(x => x.items.map(i => ({ ...i, date: x.date }))).find(i => i.kind === 'lay');
ok(lay?.pairing.id === 'p2' && lay.date === d(1), 'estimated lay from pre-lay shed (25 days for carpets)', lay && lay.date);
const hatch = o.days.flatMap(x => x.items.map(i => ({ ...i, date: x.date }))).find(i => i.kind === 'hatch');
ok(hatch?.pairing.id === 'p1', 'estimated hatch within the week', hatch);
ok(o.attention.some(x => x.text === 'F3 has refused 3 feeds in a row') && !o.attention.some(x => /F1 has refused/.test(x.text)), 'refusal streak of 3', o.attention);
ok(o.attention.some(x => x.pairingId === 'p3' && /estimated hatch was \d+d ago/.test(x.text)), 'overdue hatch flagged', o.attention);
ok(o.later.length === 1 && /Pairing season starts · Carpet/.test(o.later[0].text), 'pairing season within the month', o.later);
ok(JSON.stringify(o.last7) === '{"fed":0,"refused":1,"sheds":1,"weights":1}', 'last 7 days counts', o.last7);
ok(o.week.lays === 1 && o.week.hatches === 1, 'week totals');
const paused = O.overview(animals, events, [], [{ species: 'Carpet', pause_from: d(-3).slice(5), pause_to: d(3).slice(5) }], t);
ok(paused.dueNow.length === 0 && paused.days[3].items.some(i => i.text === 'Feeding starts again · Carpet'), 'feeding pause: nothing due, restart shown', paused.days[3]);
// Next stage for a pairing (fixed reference figures; carpet 49 ovulation-to-lay, 25 pre-lay-to-lay, 55 lay-to-hatch)
const C = { species: 'Carpet', prelay_to_lay: 99, ovul_to_lay: 99, lay_to_hatch: 99 };   // stored numbers are ignored
const ns = p => L.nextStage({ locks: [], ...p }, C);
ok(ns({}) === null, 'nothing recorded: no next stage');
ok(JSON.stringify(ns({ ovulation: '2026-09-01' })) === '{"key":"prelay_shed","date":"2026-09-25"}', 'after ovulation: pre-lay shed 24 days later', ns({ ovulation: '2026-09-01' }));
ok(JSON.stringify(ns({ ovulation: '2026-09-01', prelay_shed: '2026-09-23' })) === '{"key":"laid","date":"2026-10-18"}', 'after pre-lay shed: lay 25 days later');
ok(JSON.stringify(ns({ laid: '2026-10-18' })) === '{"key":"hatched","date":"2026-12-12"}', 'after lay: hatch 55 days later');
ok(ns({ laid: '2026-10-18', hatched: '2026-12-10' }) === null, 'hatched: done');
ok(JSON.stringify(L.nextStage({ locks: [], ovulation: '2026-09-01' }, { species: 'Bearded dragon' })) === '{"key":"laid","date":"2026-09-26"}' || L.nextStage({ locks: [], ovulation: '2026-09-01' }, { species: 'Bearded dragon' })?.key === 'laid', 'non-python: straight to lay');
const op = O.overview(animals, [], [{ id: 'p9', female_id: 'F1', male_id: 'M1', ovulation: d(-21), locks: [] }], seasons, t);
ok(op.days.some(x => x.date === d(3) && x.items.some(i => i.kind === 'prelay')), 'Overview shows the expected pre-lay shed', op.days.map(x => x.items.map(i => i.kind)));
// Holds: in shed, or the male still in. They're left out of what's due and listed as paused.
const hA = [A('S1', 'Female', d(-9), { in_shed: d(-2) }), A('P1', 'Female', d(-9)), A('P2', 'Male', d(-30)), A('N1', 'Female', d(-9))];
const ho = O.overview(hA, [], [{ id: 'pp', female_id: 'P1', male_id: 'P2', intro: d(-5), locks: [] }], [], t);
ok(ho.dueNow.map(x => x.a.id).join() === 'N1', 'only the animal with no hold is due', ho.dueNow.map(x => x.a.id));
ok(ho.held.map(x => `${x.a.id}:${x.hold.kind}`).join() === 'P1:pairing,P2:pairing,S1:shed', 'held animals listed with why', ho.held.map(x => `${x.a.id}:${x.hold.kind}`));
ok(ho.held.find(x => x.a.id === 'P1').hold.with === 'P2', 'pairing hold names the mate');
ok(!ho.days.some(x => x.items.some(i => i.kind === 'feed' && i.animals.some(a => a.id !== 'N1'))), 'held animals are not in the week ahead either');
const nf = [{ animal_id: 'N1', kind: 'feed', on_date: d(-3), ok: false }, { animal_id: 'N1', kind: 'feed', on_date: d(-2), ok: null }, { animal_id: 'N1', kind: 'feed', on_date: d(-1), ok: false },
  { animal_id: 'N1', kind: 'feed', on_date: d(-4), ok: false }];
const no = O.overview([A('N1', 'Female', d(-1))], nf, [], [], t);
ok(no.attention.some(x => x.text === 'N1 has refused 3 feeds in a row'), 'Not offered does not break a refusal streak', no.attention);
ok(no.last7.fed === 0 && no.last7.refused === 3, 'Not offered is neither fed nor refused', no.last7);
process.exit(fails ? 1 : 0);
