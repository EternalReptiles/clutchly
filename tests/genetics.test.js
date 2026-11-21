// Unit tests for lib/genetics.ts. Run: npx tsc lib/genetics.ts --outDir /tmp/gn --module commonjs --target es2020 && node tests/genetics.test.js /tmp/gn
const G = require(require('path').resolve(process.argv[2], 'genetics.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : '  got ' + JSON.stringify(got))); if (!c) fails++; };
const lib = new Map([
  ['alb', { key: 'alb', species: 'Carpet', name: 'Albino', inheritance: 'recessive', sort: 10 }],
  ['axa', { key: 'axa', species: 'Carpet', name: 'Axanthic', inheritance: 'recessive', sort: 11 }],
  ['jag', { key: 'jag', species: 'Carpet', name: 'Jaguar', inheritance: 'incomplete_dominant', super_name: 'Super Jaguar', warning: 'wobble', super_warning: 'super lethal', sort: 22 }],
  ['zeb', { key: 'zeb', species: 'Carpet', name: 'Zebra', inheritance: 'incomplete_dominant', sort: 23 }],
  ['tig', { key: 'tig', species: 'Carpet', name: 'Tiger', inheritance: 'polygenic', sort: 30 }],
]);
const pct = r => Object.fromEntries(r.outcomes.map(o => [o.label, Math.round(o.prob * 1000) / 10]));
const sum = r => Math.round(r.outcomes.reduce((s, o) => s + o.prob, 0) * 1e9) / 1e9;
let r = G.cross(lib, [{ gene_key: 'alb', state: 'het' }], [{ gene_key: 'alb', state: 'het' }]);
ok(JSON.stringify(pct(r)) === '{"Normal het Albino":50,"Albino":25,"Normal":25}', 'het x het albino: 25 / 50 / 25', pct(r));
ok(r.possibleHets[0]?.pct === 67, 'normal-looking babies are 67% possible het', r.possibleHets);
r = G.cross(lib, [{ gene_key: 'alb', state: 'visual' }], []);
ok(JSON.stringify(pct(r)) === '{"Normal het Albino":100}' && r.possibleHets.length === 0, 'visual x normal: all het (no uncertainty)', pct(r));
r = G.cross(lib, [{ gene_key: 'alb', state: 'visual' }], [{ gene_key: 'alb', state: 'het' }]);
ok(JSON.stringify(pct(r)) === '{"Albino":50,"Normal het Albino":50}', 'visual x het: 50 / 50', pct(r));
r = G.cross(lib, [{ gene_key: 'jag', state: 'visual' }], [{ gene_key: 'jag', state: 'visual' }]);
ok(JSON.stringify(pct(r)) === '{"Jaguar":50,"Normal":25,"Super Jaguar":25}', 'jaguar x jaguar: 25% Super Jaguar', pct(r));
ok(r.warnings.some(w => w.text === 'super lethal' && w.prob === 0.25) && r.warnings.some(w => w.text === 'wobble' && w.prob === 0.75), 'jaguar warnings with chances', r.warnings);
r = G.cross(lib, [{ gene_key: 'jag', state: 'visual' }], []);
ok(!r.warnings.some(w => w.text === 'super lethal') && r.warnings.some(w => w.text === 'wobble'), 'jaguar x normal: no super warning');
r = G.cross(lib, [{ gene_key: 'jag', state: 'visual' }, { gene_key: 'alb', state: 'het' }], [{ gene_key: 'zeb', state: 'visual' }, { gene_key: 'alb', state: 'visual' }]);
ok(sum(r) === 1 && r.outcomes.length === 8 && Math.abs(r.outcomes.find(o => o.label === 'Albino Jaguar Zebra').prob - 0.125) < 1e-9, 'three genes combine: 8 outcomes, Albino Jaguar Zebra 12.5%', pct(r));
r = G.cross(lib, [{ gene_key: 'alb', state: 'possible_het', het_pct: 66 }], [{ gene_key: 'alb', state: 'het' }]);
ok(Math.abs(r.outcomes.find(o => o.label === 'Albino').prob - 0.165) < 1e-9 && r.usesPossibleHets, '66% pos het x het: 16.5% albino', pct(r));
r = G.cross(lib, [{ gene_key: 'tig', state: 'visual' }], [{ gene_key: 'tig', state: 'visual' }, { gene_key: 'axa', state: 'het' }]);
ok(r.lineBred[0]?.gene.name === 'Tiger' && r.lineBred[0].from.join() === 'mother,father' && JSON.stringify(pct(r)) === '{"Normal":50,"Normal het Axanthic":50}', 'line-bred traits listed, not calculated', pct(r));
ok(JSON.stringify(pct(G.cross(lib, [], []))) === '{"Normal":100}', 'no genes: 100% normal');
ok(G.morphName(lib, [{ gene_key: 'alb', state: 'het' }, { gene_key: 'zeb', state: 'visual' }, { gene_key: 'jag', state: 'super' }, { gene_key: 'axa', state: 'possible_het', het_pct: 66 }]) === 'Super Jaguar Zebra het Albino 66% pos het Axanthic', 'morph name');
let h = G.hatchlingGenes(lib, [{ gene_key: 'alb', state: 'het' }, { gene_key: 'jag', state: 'visual' }], [{ gene_key: 'alb', state: 'het' }, { gene_key: 'axa', state: 'visual' }]);
ok(JSON.stringify(h) === '[{"gene_key":"alb","state":"possible_het","het_pct":67},{"gene_key":"axa","state":"het"}]', 'hatchlings: 67% pos het albino, 100% het axanthic, jaguar left to set', h);
h = G.hatchlingGenes(lib, [{ gene_key: 'alb', state: 'visual' }], [{ gene_key: 'alb', state: 'visual' }]);
ok(JSON.stringify(h) === '[{"gene_key":"alb","state":"visual"}]', 'visual x visual recessive: every hatchling visual', h);
process.exit(fails ? 1 : 0);
