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
process.exit(fails ? 1 : 0);
