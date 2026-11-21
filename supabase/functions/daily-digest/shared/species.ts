// GENERATED from lib/ by scripts/sync_function_shared.mjs. Do not edit here.
// Species a breeder can pick, with typical breeding timings in days (breeder reference ranges).
// Each user can override any number per species on the Season tab.
// repro: 'python' = eggs, tracks ovulation and pre-lay shed
//        'egg'    = eggs, no pre-lay shed (lizards, turtles): mating/ovulation to lay
//        'live'   = live-bearing: mating to birth (stored in ovul_to_lay)
export type Range = [number, number];
export type Repro = 'python' | 'egg' | 'live';
export type SpeciesInfo = {
  name: string; group: string; latin?: string; repro: Repro; aliases?: string[];
  ovul_to_lay?: Range; prelay_to_lay?: Range; lay_to_hatch?: Range;
};

const py = (name: string, latin: string, ovul: Range, prelay: Range, hatch: Range, aliases: string[] = []): SpeciesInfo =>
  ({ name, group: 'Pythons', latin, repro: 'python', ovul_to_lay: ovul, prelay_to_lay: prelay, lay_to_hatch: hatch, aliases });
const egg = (group: string, name: string, latin: string, ovul: Range, hatch: Range, aliases: string[] = []): SpeciesInfo =>
  ({ name, group, latin, repro: 'egg', ovul_to_lay: ovul, lay_to_hatch: hatch, aliases });
const live = (name: string, latin: string, aliases: string[] = []): SpeciesInfo =>
  ({ name, group: 'Skinks', latin, repro: 'live', ovul_to_lay: [90, 120], aliases });

// The first four names are kept exactly as before so existing animals keep their species.
export const SPECIES_INFO: SpeciesInfo[] = [
  py('Carpet', 'Morelia spilota', [42, 55], [21, 28], [52, 58], ['carpet python', 'coastal carpet', 'jungle carpet', 'murray darling carpet', 'murray-darling carpet', 'morelia', 'morelia spilota']),
  py('Diamond', 'Morelia spilota spilota', [42, 55], [21, 28], [52, 58], ['diamond python']),
  py('Bredli', 'Morelia bredli', [50, 65], [25, 35], [55, 65], ["bredl's python", 'bredls python', 'bredl', 'centralian python', 'centralian carpet']),
  py('Antaresia', 'Antaresia', [35, 48], [20, 28], [48, 56], ['spotted python', "children's python", 'childrens python', "stimson's python", 'stimsons python', 'pygmy python',
    'antaresia childreni', 'antaresia stimsoni', 'antaresia maculosa', 'antaresia perthensis', 'childreni', 'stimsoni', 'maculosa', 'perthensis']),
  py('Green tree python', 'Morelia viridis', [35, 45], [14, 22], [48, 54], ['gtp', 'chondro', 'green python']),
  py('Rough-scaled python', 'Morelia carinata', [45, 60], [25, 45], [55, 65], ['rough scaled python', 'carinata']),
  py('Woma', 'Aspidites ramsayi', [45, 60], [25, 35], [55, 65], ['woma python', 'ramsayi']),
  py('Black-headed python', 'Aspidites melanocephalus', [50, 65], [28, 40], [58, 68], ['black headed python', 'bhp', 'melanocephalus']),
  py('Water python', 'Liasis fuscus', [45, 55], [20, 30], [55, 65], ['fuscus']),
  py('Olive python', 'Liasis olivaceus', [50, 65], [25, 35], [65, 80], ['olivaceus']),
  py('Scrub python', 'Simalia kinghorni', [50, 65], [25, 35], [70, 85], ['amethystine python', 'kinghorni']),

  egg('Dragons', 'Bearded dragon', 'Pogona vitticeps / barbata', [21, 35], [55, 75], ['central bearded dragon', 'eastern bearded dragon', 'beardie', 'pogona', 'pogona vitticeps', 'pogona barbata']),
  egg('Dragons', 'Pygmy bearded dragon', 'Pogona henrylawsoni', [20, 30], [50, 65], ["rankin's dragon", 'rankins dragon', 'henrylawsoni']),
  egg('Dragons', 'Central netted dragon', 'Ctenophorus nuchalis', [20, 30], [45, 60], ['netted dragon', 'nuchalis']),
  egg('Dragons', 'Eastern water dragon', 'Intellagama lesueurii', [25, 40], [60, 80], ['water dragon', 'lesueurii']),
  egg('Dragons', 'Frilled-neck lizard', 'Chlamydosaurus kingii', [25, 40], [65, 85], ['frilled neck lizard', 'frillneck', 'frilled lizard', 'kingii']),

  egg('Monitors', 'Ackie monitor', 'Varanus acanthurus', [25, 35], [90, 120], ['ackie', 'ridge-tailed monitor', 'ridge tailed monitor', 'acanthurus']),
  egg('Monitors', "Gillen's monitor", 'Varanus gilleni', [25, 35], [95, 125], ['gillens monitor', 'pygmy mulga monitor', 'gilleni']),
  egg('Monitors', 'Sand monitor', 'Varanus gouldii', [30, 45], [160, 210], ["gould's monitor", 'goulds monitor', 'gouldii']),
  egg('Monitors', "Mertens' water monitor", 'Varanus mertensi', [30, 45], [160, 210], ['mertens water monitor', "merten's water monitor", 'mertensi']),
  egg('Monitors', 'Lace monitor', 'Varanus varius', [25, 40], [220, 280], ['lacie', 'varius']),

  egg('Geckos', 'Knob-tailed gecko', 'Nephrurus', [25, 35], [55, 70], ['knob tailed gecko', 'knobtail', 'nephrurus']),
  egg('Geckos', 'Thick-tailed gecko', 'Underwoodisaurus milii', [25, 35], [55, 65], ['thick tailed gecko', 'barking gecko', 'milii']),
  egg('Geckos', 'Spiny-tailed gecko', 'Strophurus', [25, 35], [55, 75], ['spiny tailed gecko', 'strophurus']),
  egg('Geckos', 'Velvet gecko', 'Oedura', [25, 35], [55, 75], ['oedura']),

  live('Blue-tongue skink', 'Tiliqua', ['blue tongue skink', 'blue tongue', 'bluey', 'tiliqua', 'tiliqua scincoides']),
  live('Shingleback', 'Tiliqua rugosa', ['shingleback skink', 'bobtail', 'rugosa']),
  live("Cunningham's skink", 'Egernia cunninghami', ['cunninghams skink', 'cunningham skink', 'egernia', 'cunninghami']),
  live('Pink-tongue skink', 'Cyclodomorphus gerrardii', ['pink tongue skink', 'pink tongue', 'cyclodomorphus', 'gerrardii']),

  egg('Turtles', 'Eastern long-necked turtle', 'Chelodina longicollis', [30, 45], [90, 130], ['eastern long necked turtle', 'long-necked turtle', 'long necked turtle', 'snake-necked turtle', 'longicollis']),
  egg('Turtles', 'Murray River turtle', 'Emydura macquarii', [30, 45], [45, 65], ['murray river short-necked turtle', 'murray turtle', 'macquarii']),
  egg('Turtles', 'Saw-shelled turtle', 'Myuchelys latisternum', [30, 45], [50, 70], ['saw shelled turtle', 'latisternum']),
  egg('Turtles', "Krefft's turtle", 'Emydura krefftii', [30, 45], [50, 70], ['kreffts turtle', 'krefftii']),

  // No suggested timings: estimates appear once the user sets their own numbers.
  { name: 'Other', group: 'Other', repro: 'python' },
];

export const SPECIES = SPECIES_INFO.map(s => s.name);
export const GROUPS = [...new Set(SPECIES_INFO.map(s => s.group))];
const BY_NAME = new Map(SPECIES_INFO.map(s => [s.name, s]));
const OTHER = BY_NAME.get('Other')!;
export const speciesInfo = (name?: string | null): SpeciesInfo => (name && BY_NAME.get(name)) || OTHER;

const norm = (v: string) => v.trim().toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
const LOOKUP = new Map<string, string>();
for (const s of SPECIES_INFO) for (const k of [s.name, s.latin, ...(s.aliases ?? [])]) if (k) LOOKUP.set(norm(k), s.name);
/** Name, Latin name or common alias -> species name, or null if unknown. */
export function findSpecies(v: string): string | null {
  const k = norm(v); if (!k) return null;
  return LOOKUP.get(k) ?? LOOKUP.get(k.replace(/ python$/, '')) ?? null;
}
/** Species whose name, Latin name or alias contains the search text. */
export const searchSpecies = (q: string) => {
  const k = norm(q); if (!k) return SPECIES_INFO;
  return SPECIES_INFO.filter(s => [s.name, s.latin, ...(s.aliases ?? [])].some(x => x && norm(x).includes(k)));
};

// Wording that depends on how the species reproduces.
export const words = (r: Repro) => r === 'live'
  ? { ovulation: 'Mating', ovulToLay: 'Days from mating to birth', laid: 'Born', est: 'estimated birth', locks: 'Matings', lock: 'mating', clutch: 'Litter size' }
  : r === 'egg'
    ? { ovulation: 'Mating / ovulation', ovulToLay: 'Days from mating / ovulation to lay', laid: 'Eggs laid', est: 'estimated lay', locks: 'Matings', lock: 'mating', clutch: 'Clutch size' }
    : { ovulation: 'Ovulation', ovulToLay: 'Days from ovulation to lay', laid: 'Eggs laid', est: 'estimated lay', locks: 'Locks', lock: 'lock', clutch: 'Clutch size' };
