// Unit tests for lib/genetics.ts. Run: npx tsc lib/genetics.ts --outDir /tmp/gn --module commonjs --target es2020 && node tests/genetics.test.js /tmp/gn
const G = require(require('path').resolve(process.argv[2], 'genetics.js'));
let fails = 0; const ok = (c, m, got) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : '  got ' + JSON.stringify(got))); if (!c) fails++; };
const gene = (key, name, inheritance, sort, x = {}) => [key, { key, species: 'Carpet', name, inheritance, sort, ...x }];
const genes = new Map([
  gene('alb', 'Albino', 'recessive', 10), gene('axa', 'Axanthic', 'recessive', 11),
  gene('car', 'Caramel', 'incomplete_dominant', 20, { super_name: 'Super Caramel' }), gene('hyp', 'Hypo', 'incomplete_dominant', 21, { super_name: 'Super Hypo' }),
  gene('jag', 'Jaguar', 'dominant', 22, { has_super: false, warning: 'wobble', super_warning: 'not recommended' }),
  gene('zeb', 'Zebra', 'incomplete_dominant', 23, { super_name: 'Super Zebra', super_warning: 'tail kinks' }),
  gene('tig', 'Tiger', 'polygenic', 30),
]);
const combos = [
  { id: 's', species: 'Carpet', name: 'Sunglow', groups: [['car', 'hyp'], ['alb']] },
  { id: 'm', species: 'Carpet', name: 'Moonglow', groups: [['car', 'hyp'], ['alb'], ['axa']] },
  { id: 'n', species: 'Carpet', name: 'Snow', groups: [['alb'], ['axa']] },
  { id: 'g', species: 'Carpet', name: 'Ghost', groups: [['car', 'hyp'], ['axa']] },
];
const lib = { genes, combos };
const pct = r => Object.fromEntries(r.outcomes.map(o => [o.label, Math.round(o.prob * 10000) / 100]));
const sum = r => Math.round(r.outcomes.reduce((s, o) => s + o.prob, 0) * 1e9) / 1e9;
const A = (gene_key, state, het_pct) => ({ gene_key, state, het_pct });

// Combination names
const name = list => G.morphName(lib, list);
ok(name([A('car', 'visual'), A('alb', 'visual')]) === 'Sunglow', 'Caramel + Albino = Sunglow');
ok(name([A('hyp', 'visual'), A('alb', 'visual')]) === 'Sunglow', 'Hypo + Albino = Sunglow');
ok(name([A('hyp', 'visual'), A('alb', 'visual'), A('axa', 'visual')]) === 'Moonglow', 'Hypo + Albino + Axanthic = Moonglow (most specific wins)');
ok(name([A('alb', 'visual'), A('axa', 'visual')]) === 'Snow', 'Albino + Axanthic = Snow');
ok(name([A('car', 'visual'), A('axa', 'visual')]) === 'Ghost', 'Caramel + Axanthic = Ghost');
ok(name([A('jag', 'visual'), A('car', 'visual'), A('alb', 'visual'), A('axa', 'het')]) === 'Jaguar Sunglow het Axanthic', 'other genes stay: Jaguar Sunglow het Axanthic', name([A('jag', 'visual'), A('car', 'visual'), A('alb', 'visual'), A('axa', 'het')]));
ok(name([A('car', 'visual'), A('hyp', 'visual'), A('alb', 'visual')]) === 'Hypo Sunglow', 'Caramel + Hypo + Albino: one is used by Sunglow, the other stays', name([A('car', 'visual'), A('hyp', 'visual'), A('alb', 'visual')]));
ok(name([A('car', 'super'), A('alb', 'visual')]) === 'Super Caramel Albino', 'super forms do not count towards combinations');
ok(name([A('zeb', 'super'), A('jag', 'visual'), A('alb', 'het'), A('axa', 'possible_het', 66), A('tig', 'visual')]) === 'Jaguar Super Zebra Tiger het Albino 66% pos het Axanthic', 'full name order', name([A('zeb', 'super'), A('jag', 'visual'), A('alb', 'het'), A('axa', 'possible_het', 66), A('tig', 'visual')]));
ok(name([A('jag', 'super')]) === 'Jaguar', 'there is no Super Jaguar');

// Odds
let r = G.cross(lib, [A('alb', 'het')], [A('alb', 'het')]);
ok(JSON.stringify(pct(r)) === '{"Normal het Albino":50,"Albino":25,"Normal":25}' && r.outcomes.map(o => o.fraction).join() === '1/2,1/4,1/4', 'het x het: 1/2, 1/4, 1/4', r.outcomes);
ok(r.possibleHets[0]?.pct === 67, 'normal-looking babies: 67% possible het');
r = G.cross(lib, [A('car', 'visual'), A('alb', 'het')], [A('alb', 'visual'), A('axa', 'het')]);
ok(r.outcomes.find(o => o.label === 'Sunglow het Axanthic')?.fraction === '1/8', 'combo names appear in results (Sunglow het Axanthic 1/8)', pct(r));
r = G.cross(lib, [A('jag', 'visual')], [A('jag', 'visual')]);
ok(Math.abs(r.nonViable - 0.25) < 1e-9 && JSON.stringify(pct(r)) === '{"Jaguar":66.67,"Normal":33.33}' && r.outcomes[0].fraction === '2/3', 'jag x jag: 1/4 of eggs not viable; of the rest 2/3 Jaguar', pct(r));
ok(r.warnings.some(w => w.text === 'not recommended' && w.severe && w.prob === 0.25), 'jag x jag: not-recommended warning', r.warnings);
r = G.cross(lib, [A('jag', 'visual')], []);
ok(r.nonViable === 0 && !r.warnings.some(w => w.severe) && r.warnings.some(w => w.text === 'wobble' && w.prob === 0.5), 'jag x normal: wobble warning only');
r = G.cross(lib, [A('zeb', 'visual')], [A('zeb', 'visual')]);
ok(JSON.stringify(pct(r)) === '{"Zebra":50,"Normal":25,"Super Zebra":25}' && r.warnings.some(w => w.text === 'tail kinks' && w.prob === 0.25), 'zebra x zebra: 1/4 Super Zebra with warning', pct(r));
r = G.cross(lib, [A('jag', 'visual'), A('alb', 'het')], [A('zeb', 'visual'), A('alb', 'visual')]);
ok(sum(r) === 1 && r.outcomes.length === 8 && r.outcomes.find(o => o.label === 'Jaguar Zebra Albino')?.fraction === '1/8', 'three genes: 8 outcomes, Jaguar Zebra Albino 1/8', pct(r));
r = G.cross(lib, [A('alb', 'possible_het', 66)], [A('alb', 'het')]);
ok(Math.abs(r.outcomes.find(o => o.label === 'Albino').prob - 0.165) < 1e-9 && r.usesPossibleHets && r.outcomes[0].fraction === null, '66% pos het x het: 16.5% albino, no fractions', pct(r));
r = G.cross(lib, [A('tig', 'visual')], [A('tig', 'visual'), A('axa', 'het')]);
ok(r.lineBred[0]?.gene.name === 'Tiger' && r.lineBred[0].from.join() === 'mother,father' && JSON.stringify(pct(r)) === '{"Normal":50,"Normal het Axanthic":50}', 'line-bred traits listed, not calculated');
ok(JSON.stringify(pct(G.cross(lib, [], []))) === '{"Normal":100}', 'no genes: 100% normal');
ok(G.fraction(1 / 16) === '1/16' && G.fraction(3 / 64) === '3/64' && G.fraction(0.165) === '33/200', 'fractions');
// Hatchlings
let h = G.hatchlingGenes(genes, [A('alb', 'het'), A('jag', 'visual')], [A('alb', 'het'), A('axa', 'visual')]);
ok(JSON.stringify(h) === '[{"gene_key":"alb","state":"possible_het","het_pct":67},{"gene_key":"axa","state":"het"}]', 'hatchlings: 67% pos het albino, het axanthic, jaguar left to set', h);
process.exit(fails ? 1 : 0);
