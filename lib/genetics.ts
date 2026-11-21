// Morph genetics: single-gene odds for a pairing, combination names (e.g. Albino + Axanthic = Snow), and warnings.
// Pure (unit-tested in tests/genetics.test.js). Genes are assumed to be inherited independently (no linkage).
// Line-bred (polygenic) traits are listed, not predicted.
export type Inheritance = 'recessive' | 'incomplete_dominant' | 'dominant' | 'polygenic';
export type Gene = { key: string; species: string; name: string; inheritance: Inheritance; description?: string | null;
  super_name?: string | null; warning?: string | null; super_warning?: string | null; sort?: number; custom?: boolean;
  has_super?: boolean };  // false: the double-copy form doesn't exist / isn't viable (e.g. Jaguar)
export type Combo = { id: string; species: string; name: string; groups: string[][]; description?: string | null };
export type GeneState = 'visual' | 'super' | 'het' | 'possible_het';
export type AnimalGene = { gene_key: string; state: GeneState; het_pct?: number | null };
export type Lib = { genes: Map<string, Gene>; combos: Combo[] };

const isDominantType = (g: Gene) => g.inheritance === 'incomplete_dominant' || g.inheritance === 'dominant';
const superName = (g: Gene) => g.super_name || `Super ${g.name}`;
const order = (a: Gene, b: Gene) => (a.sort ?? 99) - (b.sort ?? 99) || a.name.localeCompare(b.name);

/** Chance this parent passes on a copy of the gene. */
export function passChance(g: Gene, s?: AnimalGene): number {
  if (!s || g.inheritance === 'polygenic') return 0;
  if (g.inheritance === 'recessive') return s.state === 'visual' ? 1 : s.state === 'het' ? 0.5 : s.state === 'possible_het' ? ((s.het_pct ?? 50) / 100) * 0.5 : 0;
  return s.state === 'super' && g.has_super !== false ? 1 : s.state === 'visual' || s.state === 'super' ? 0.5 : 0;
}
/** Offspring chance of carrying 0, 1 or 2 copies. */
export function copies(q1: number, q2: number): [number, number, number] {
  return [(1 - q1) * (1 - q2), q1 * (1 - q2) + q2 * (1 - q1), q1 * q2];
}

/**
 * Name for an animal from its genes: dominant genes first, then a combination name (the most specific matching
 * combination, which "uses up" one gene per requirement), then other visual recessives, then line-bred traits.
 * Super forms don't count towards combinations.
 */
export function visualName(lib: Lib, shown: { g: Gene; n: number }[], traits: Gene[] = []): string {
  const vis = shown.filter(x => x.g.inheritance === 'recessive' ? x.n === 2 : x.n >= 1);
  const comboUsable = new Set(vis.filter(x => x.g.inheritance === 'recessive' || x.n === 1 || x.g.has_super === false).map(x => x.g.key));
  const species = vis[0]?.g.species;
  const best = lib.combos.filter(c => c.species === species && c.groups.every(gr => gr.some(k => comboUsable.has(k))))
    .sort((a, b) => b.groups.length - a.groups.length)[0];
  const used = new Set(best ? best.groups.map(gr => gr.find(k => comboUsable.has(k))!) : []);
  const rest = vis.filter(x => !used.has(x.g.key));
  const dom = rest.filter(x => isDominantType(x.g)).sort((a, b) => order(a.g, b.g)).map(x => x.n === 2 && x.g.has_super !== false ? superName(x.g) : x.g.name);
  const rec = rest.filter(x => x.g.inheritance === 'recessive').sort((a, b) => order(a.g, b.g)).map(x => x.g.name);
  return [...dom, ...(best ? [best.name] : []), ...rec, ...traits.sort(order).map(t => t.name)].join(' ');
}

/** Readable morph name for an animal, e.g. "Jaguar Sunglow het Axanthic 66% pos het Granite". */
export function morphName(lib: Lib, ag: AnimalGene[]): string {
  const rows = ag.map(a => ({ a, g: lib.genes.get(a.gene_key) })).filter((x): x is { a: AnimalGene; g: Gene } => !!x.g);
  const shown = rows.filter(r => r.g.inheritance !== 'polygenic' && (r.a.state === 'visual' || r.a.state === 'super'))
    .map(r => ({ g: r.g, n: r.g.inheritance === 'recessive' ? 2 : r.a.state === 'super' && r.g.has_super !== false ? 2 : 1 }));
  const traits = rows.filter(r => r.g.inheritance === 'polygenic').map(r => r.g);
  const het = rows.filter(r => r.a.state === 'het').sort((x, y) => order(x.g, y.g)).map(r => `het ${r.g.name}`);
  const pos = rows.filter(r => r.a.state === 'possible_het').sort((x, y) => order(x.g, y.g)).map(r => `${r.a.het_pct ?? 50}% pos het ${r.g.name}`);
  return [visualName(lib, shown, traits), ...het, ...pos].filter(Boolean).join(' ');
}

/** Exact fraction like "1/16" when there is a small one (no possible-het percentages involved). */
export function fraction(p: number): string | null {
  for (let den = 1; den <= 4096; den++) { const num = Math.round(p * den); if (num > 0 && Math.abs(p * den - num) < 1e-9) return `${num}/${den}`; }
  return null;
}

export type Outcome = { prob: number; fraction: string | null; name: string; hets: string[]; label: string };
export type CrossResult = {
  outcomes: Outcome[];
  /** For babies that don't show a recessive gene: the chance they carry it (only when uncertain). */
  possibleHets: { gene: Gene; pct: number }[];
  lineBred: { gene: Gene; from: ('mother' | 'father')[] }[];
  warnings: { gene: Gene; text: string; prob: number; severe?: boolean }[];
  /** Share of eggs expected not to develop (double copies of a gene with no viable super form, e.g. Jaguar). */
  nonViable: number;
  usesPossibleHets: boolean;
};

export function cross(lib: Lib, mother: AnimalGene[], father: AnimalGene[]): CrossResult {
  const { genes } = lib;
  const m = new Map(mother.map(a => [a.gene_key, a])), f = new Map(father.map(a => [a.gene_key, a]));
  const keys = [...new Set([...m.keys(), ...f.keys()])].filter(k => genes.has(k)).sort((a, b) => order(genes.get(a)!, genes.get(b)!));
  const single = keys.map(k => genes.get(k)!).filter(g => g.inheritance !== 'polygenic');
  const dists = single.map(g => ({ g, d: copies(passChance(g, m.get(g.key)), passChance(g, f.get(g.key))) }));

  // Every combination of copies across genes (independent assortment).
  let combos: { prob: number; shown: { g: Gene; n: number }[]; dead: boolean }[] = [{ prob: 1, shown: [], dead: false }];
  for (const { g, d } of dists) {
    const next: typeof combos = [];
    for (const c of combos) for (let n = 0; n <= 2; n++) {
      if (d[n] <= 0) continue;
      next.push({ prob: c.prob * d[n], shown: n ? [...c.shown, { g, n }] : c.shown, dead: c.dead || (n === 2 && g.has_super === false) });
    }
    combos = next;
  }
  const nonViable = combos.filter(c => c.dead).reduce((s, c) => s + c.prob, 0);
  const viable = 1 - nonViable;
  const usesPossibleHets = [...mother, ...father].some(a => a.state === 'possible_het' && genes.get(a.gene_key)?.inheritance === 'recessive');

  const merged = new Map<string, Outcome>();
  for (const c of combos.filter(c => !c.dead)) {
    const name = visualName(lib, c.shown) || 'Normal';
    const hets = c.shown.filter(x => x.g.inheritance === 'recessive' && x.n === 1).sort((a, b) => order(a.g, b.g)).map(x => x.g.name);
    const label = [name, ...hets.map(h => `het ${h}`)].join(' ');
    const p = c.prob / viable;
    const o = merged.get(label);
    if (o) o.prob += p; else merged.set(label, { prob: p, fraction: null, name, hets, label });
  }
  const outcomes = [...merged.values()].map(o => ({ ...o, fraction: usesPossibleHets ? null : fraction(o.prob) }))
    .sort((a, b) => b.prob - a.prob || a.label.localeCompare(b.label));

  const possibleHets = dists.filter(x => x.g.inheritance === 'recessive').flatMap(({ g, d }) => {
    const p = d[0] + d[1] > 0 ? d[1] / (d[0] + d[1]) : 0;
    return p > 0 && p < 1 ? [{ gene: g, pct: Math.round(p * 100) }] : [];
  });
  const lineBred = keys.map(k => genes.get(k)!).filter(g => g.inheritance === 'polygenic')
    .map(g => ({ gene: g, from: [...(m.has(g.key) ? ['mother' as const] : []), ...(f.has(g.key) ? ['father' as const] : [])] }));
  const warnings = dists.flatMap(({ g, d }) => {
    const any = g.has_super === false ? d[1] / viable : (d[1] + d[2]) / viable;
    return [
      ...(g.super_warning && d[2] > 0 ? [{ gene: g, text: g.super_warning, prob: g.has_super === false ? d[2] : d[2] / viable, severe: g.has_super === false }] : []),
      ...(g.warning && any > 0 ? [{ gene: g, text: g.warning, prob: any }] : []),
    ];
  });
  return { outcomes, possibleHets, lineBred, warnings, nonViable, usesPossibleHets };
}

/**
 * Genes to record on a new hatchling before its looks are known: recessive genes it carries for sure (het) or may
 * carry (possible het, %), and recessive genes every baby shows (both parents visual). Visual single genes that only
 * some babies show are left for the breeder to set.
 */
export function hatchlingGenes(genes: Map<string, Gene>, mother: AnimalGene[], father: AnimalGene[]): AnimalGene[] {
  const m = new Map(mother.map(a => [a.gene_key, a])), f = new Map(father.map(a => [a.gene_key, a]));
  const out: AnimalGene[] = [];
  for (const key of new Set([...m.keys(), ...f.keys()])) {
    const g = genes.get(key); if (!g || g.inheritance !== 'recessive') continue;
    const [p0, p1, p2] = copies(passChance(g, m.get(key)), passChance(g, f.get(key)));
    if (p2 >= 0.999) { out.push({ gene_key: key, state: 'visual' }); continue; }
    const pct = p0 + p1 > 0 ? p1 / (p0 + p1) : 0;
    if (pct >= 0.995) out.push({ gene_key: key, state: 'het' });
    else if (pct > 0) out.push({ gene_key: key, state: 'possible_het', het_pct: Math.min(99, Math.max(1, Math.round(pct * 100))) });
  }
  return out;
}
