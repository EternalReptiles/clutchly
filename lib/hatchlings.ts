// Hatchling IDs from a user-set pattern. Pure (unit-tested in tests/hatchlings.test.js).
// Placeholders: {YYYY} {YY} hatch year · {###} running number, zero-padded to the number of #s · {MOTHER} {FATHER} parents' names.
export const DEFAULT_PATTERN = '{YYYY}-{###}';
const SEQ = /\{(#+)\}/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Adds a running number if the pattern has none, so every name can be unique. */
export const normalisePattern = (p: string) => { const t = p.trim() || DEFAULT_PATTERN; return SEQ.test(t) ? t : `${t}-{##}`; };

function fill(pattern: string, v: { year: string; mother: string; father: string }) {
  return pattern.replace(/\{YYYY\}/g, v.year).replace(/\{YY\}/g, v.year.slice(2)).replace(/\{MOTHER\}/g, v.mother).replace(/\{FATHER\}/g, v.father);
}

/**
 * `count` new names. Numbering continues after the highest number already used with the same pattern and year,
 * and skips any name that already exists (names are compared case-insensitively).
 */
export function hatchlingNames(pattern: string, hatchDate: string, mother: string, father: string, count: number, existing: string[]): string[] {
  const p = normalisePattern(pattern); const width = p.match(SEQ)![1].length;
  const base = fill(p, { year: hatchDate.slice(0, 4), mother, father });
  const [pre, post] = base.split(SEQ.exec(base)![0]);
  const re = new RegExp(`^${esc(pre)}(\\d+)${esc(post)}$`, 'i');
  const taken = new Set(existing.map(n => n.toLowerCase()));
  let next = 1 + Math.max(0, ...existing.map(n => re.exec(n)?.[1]).filter(Boolean).map(Number));
  const out: string[] = [];
  while (out.length < count) {
    const name = `${pre}${String(next++).padStart(width, '0')}${post}`;
    if (!taken.has(name.toLowerCase())) { out.push(name); taken.add(name.toLowerCase()); }
  }
  return out;
}
