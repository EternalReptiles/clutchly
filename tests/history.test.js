// Unit tests for lib/history.ts. Run: npx tsc lib/history.ts lib/logic.ts lib/species.ts --outDir /tmp/ht --module commonjs --target es2020 --skipLibCheck && node tests/history.test.js /tmp/ht
const h = require(require('path').resolve(process.argv[2], 'history.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const E = (id, kind, on_date, x = {}) => ({ id, animal_id: 'A', kind, on_date, ok: null, food: null, grams: null, ...x });
const ev = [E('1', 'shed', '2026-01-01'), E('2', 'shed', '2026-02-10'), E('3', 'shed', '2026-03-22'), E('3b', 'shed', '2026-03-22'),
  E('4', 'feed', '2026-11-21', { ok: false }), E('5', 'feed', '2026-11-14', { ok: true }), E('6', 'feed', '2026-08-24', { ok: false }),
  E('7', 'feed', '2026-08-23', { ok: false }), E('8', 'weight', '2026-05-01', { grams: 300 }), E('9', 'weight', '2026-06-01', { grams: 350 }),
  E('10', 'weight', '2026-06-01', { grams: 360, created_at: '2026-06-01T10:00:00Z' })];
ok(JSON.stringify(h.shedStats(ev)) === '{"count":3,"avgDays":40}', 'average days between sheds (same-day duplicates counted once)');
ok(h.shedStats([E('x', 'shed', '2026-01-01')]).avgDays === null, 'one shed: no average');
const r = h.refusalStats(ev, '2026-11-21');
ok(r.offered === 3 && r.refused === 2 && Math.abs(r.rate - 2 / 3) < 1e-9, '90-day refusal rate includes day 90 (24 Aug), excludes 23 Aug');
ok(h.refusalStats([], '2026-11-21').rate === null, 'no feeds: no rate');
ok(JSON.stringify(h.weightSeries(ev)) === '[{"date":"2026-05-01","grams":300},{"date":"2026-06-01","grams":360}]', 'weight series: one point per day (last logged), oldest first');
ok(h.filterEvents(ev, { kinds: ['feed'], from: '2026-09-01', to: null }).map(e => e.id).join() === '4,5', 'filter by type and from date, newest first');
ok(h.filterEvents(ev, { kinds: ['shed', 'weight'], from: '2026-02-01', to: '2026-05-31' }).map(e => e.id).join() === '8,3,3b,2', 'filter by several types and a date range');
ok(JSON.stringify(h.niceTicks(287, 1430)) === '[0,500,1000,1500]' || JSON.stringify(h.niceTicks(287, 1430)).startsWith('[250'), 'nice ticks ' + JSON.stringify(h.niceTicks(287, 1430)));
ok(JSON.stringify(h.niceTicks(48, 62)) === '[45,50,55,60,65]', 'nice ticks for small range ' + JSON.stringify(h.niceTicks(48, 62)));
ok(h.eventLabel(E('a', 'feed', '2026-01-01', { ok: true, food: 'rat' })) === 'Fed (rat)' && h.eventLabel(E('b', 'weight', 'x', { grams: 12.5 })) === '12.5 g', 'labels');
process.exit(fails ? 1 : 0);
