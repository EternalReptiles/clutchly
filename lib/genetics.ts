// Morph genetics: single-gene odds for a pairing. Pure (unit-tested in tests/genetics.test.js).
// Each gene is assumed to be inherited independently (no linkage). Line-bred (polygenic) traits are listed, not predicted.
export type Inheritance = 'recessive' | 'incomplete_dominant' | 'dominant' | 'polygenic';
export type Gene = { key: string; species: string; name: string; inheritance: Inheritance; description?: string | null;
  super_name?: string | null; warning?: string | null; super_warning?: string | null; sort?: number; custom?: boolean };
export type GeneState = 'visual' | 'super' | 'het' | 'possible_het';
export type AnimalGene = { gene_key: string; state: GeneState; het_pct?: number | null };

/** Chance this parent passes on a copy of the gene. */
export function passChance(g: Gene, s?: AnimalGene): number {
  if (!s || g.inheritance === 'polygenic') return 0;
  if (g.inheritance === 'recessive') return s.state === 'visual' ? 1 : s.state === 'het' ? 0.5 : s.state === 'possible_het' ? ((s.het_pct ?? 50) / 100) * 0.5 : 0;
  return s.state === 'super' ? 1 : s.state === 'visual' ? 0.5 : 0;
}
/** Offspring chance of carrying 0, 1 or 2 copies. */
export function copies(q1: number, q2: number): [number, number, number] {
  return [(1 - q1) * (1 - q2), q1 * (1 - q2) + q2 * (1 - q1), q1 * q2];
}
const superName = (g: Gene) => g.super_name || `Super ${g.name}`;
/** How one gene shows in an animal with this many copies: [visual name or null, het name or null]. */
function show(g: Gene, n: number): [string | null, string | null] {
  if (n === 0) return [null, null];
  if (g.inheritance === 'recessive') return n === 2 ? [g.name, null] : [null, g.name];
  return [n === 2 ? superName(g) : g.name, null];
}

/** Readable morph name for an animal, e.g. "Jaguar Zebra het Albino 66% pos het Axanthic". */
export function morphName(genes: Map<string, Gene>, ag: AnimalGene[]): string {
  const rows = ag.map(a => ({ a, g: genes.get(a.gene_key) })).filter((x): x is { a: AnimalGene; g: Gene } => !!x.g)
    .sort((x, y) => (x.g.sort ?? 99) - (y.g.sort ?? 99) || x.g.name.localeCompare(y.g.name));
  const vis = rows.filter(r => r.a.state === 'visual' || r.a.state === 'super').map(r => r.a.state === 'super' ? superName(r.g) : r.g.name);
  const het = rows.filter(r => r.a.state === 'het').map(r => `het ${r.g.name}`);
  const pos = rows.filter(r => r.a.state === 'possible_het').map(r => `${r.a.het_pct ?? 50}% pos het ${r.g.name}`);
  return [...vis, ...het, ...pos].join(' ');
}

export type Outcome = { prob: number; label: string; visuals: string[]; hets: string[] };
export type CrossResult = {
  outcomes: Outcome[];
  /** For offspring that don't show a recessive gene: the chance they carry it (only when uncertain). */
  possibleHets: { gene: Gene; pct: number }[];
  lineBred: { gene: Gene; from: ('mother' | 'father')[] }[];
  warnings: { gene: Gene; text: string; prob: number }[];
  usesPossibleHets: boolean;
};

export function cross(genes: Map<string, Gene>, mother: AnimalGene[], father: AnimalGene[]): CrossResult {
  const m = new Map(mother.map(a => [a.gene_key, a])), f = new Map(father.map(a => [a.gene_key, a]));
  const keys = [...new Set([...m.keys(), ...f.keys()])].filter(k => genes.has(k))
    .sort((a, b) => (genes.get(a)!.sort ?? 99) - (genes.get(b)!.sort ?? 99) || genes.get(a)!.name.localeCompare(genes.get(b)!.name));
  const single = keys.map(k => genes.get(k)!).filter(g => g.inheritance !== 'polygenic');
  const dists = single.map(g => ({ g, d: copies(passChance(g, m.get(g.key)), passChance(g, f.get(g.key))) }));

  // Every combination of copies across genes (independent assortment), merged by how the baby is described.
  let combos: { prob: number; visuals: string[]; hets: string[] }[] = [{ prob: 1, visuals: [], hets: [] }];
  for (const { g, d } of dists) {
    const next: typeof combos = [];
    for (const c of combos) for (let n = 0; n <= 2; n++) {
      if (d[n] <= 0) continue;
      const [v, h] = show(g, n);
      next.push({ prob: c.prob * d[n], visuals: v ? [...c.visuals, v] : c.visuals, hets: h ? [...c.hets, h] : c.hets });
    }
    combos = next;
  }
  const merged = new Map<string, Outcome>();
  for (const c of combos) {
    const label = [c.visuals.join(' ') || 'Normal', ...c.hets.map(h => `het ${h}`)].join(' ');
    const o = merged.get(label);
    if (o) o.prob += c.prob; else merged.set(label, { prob: c.prob, label, visuals: c.visuals, hets: c.hets });
  }
  const outcomes = [...merged.values()].sort((a, b) => b.prob - a.prob || a.label.localeCompare(b.label));

  const possibleHets = dists.filter(x => x.g.inheritance === 'recessive').flatMap(({ g, d }) => {
    const p = d[0] + d[1] > 0 ? d[1] / (d[0] + d[1]) : 0;
    return p > 0 && p < 1 ? [{ gene: g, pct: Math.round(p * 100) }] : [];
  });
  const lineBred = keys.map(k => genes.get(k)!).filter(g => g.inheritance === 'polygenic')
    .map(g => ({ gene: g, from: [...(m.has(g.key) ? ['mother' as const] : []), ...(f.has(g.key) ? ['father' as const] : [])] }));
  const warnings = dists.flatMap(({ g, d }) => [
    ...(g.warning && d[1] + d[2] > 0 ? [{ gene: g, text: g.warning, prob: d[1] + d[2] }] : []),
    ...(g.super_warning && d[2] > 0 ? [{ gene: g, text: g.super_warning, prob: d[2] }] : []),
  ]);
  const usesPossibleHets = [...mother, ...father].some(a => a.state === 'possible_het' && genes.get(a.gene_key)?.inheritance === 'recessive');
  return { outcomes, possibleHets, lineBred, warnings, usesPossibleHets };
}

/**
 * Genes to record on a new hatchling before its looks are known: recessive genes it carries for sure (het) or
 * may carry (possible het, %), and recessive genes every baby shows (both parents visual). Visual single genes
 * that only some babies show are left for the breeder to set.
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
