// Parses pasted lines or a CSV file into animals to import.
// Columns: name, species, sex, hatch date (optional), last feed date (optional).
// A header row is optional; with one, columns can be in any order.
import { iso, today } from './logic';
import { findSpecies } from './species';

export type Row = {
  line: number; raw: string;
  name: string; species: string; sex: string; dob: string | null; last_feed: string | null;
  error?: string;
};

// One CSV line -> fields. Handles quotes ("Smith, J") and doubled quotes inside them.
export function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// Accepts the species name, Latin name or a common alias (see lib/species.ts).
export const parseSpecies = (v: string): string | null => findSpecies(v);
export function parseSex(v: string): string | null {
  const k = v.trim().toLowerCase();
  if (['f', 'female', '0.1', '♀'].includes(k)) return 'Female';
  if (['m', 'male', '1.0', '♂'].includes(k)) return 'Male';
  if (['u', 'unknown', 'unsexed', '?', '0.0.1'].includes(k)) return 'Unknown';
  return null;
}

/**
 * Accepts 2024-01-31, and day/month/year or month/day/year with / . or - separators.
 * dayFirst decides 03/04/2024: true = 3 April (AU), false = March 4 (US).
 * Returns ISO date, or an error string starting with '!'.
 */
export function parseDate(v: string, dayFirst: boolean): string | null {
  const t = v.trim(); if (!t) return null;
  let y: number, m: number, d: number;
  let x = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (x) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    const a = +x[1], b = +x[2]; y = +x[3];
    [d, m] = dayFirst ? [a, b] : [b, a];
  } else return `!"${t}" is not a date. Use ${dayFirst ? 'DD/MM/YYYY' : 'MM/DD/YYYY'} or YYYY-MM-DD`;
  const dt = new Date(y, m - 1, d, 12);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return `!"${t}" is not a real date`;
  const out = iso(dt);
  if (out > today()) return `!"${t}" is in the future`;
  if (y < 1950) return `!"${t}" is too far in the past`;
  return out;
}

const HEADERS: Record<string, keyof Row> = {
  name: 'name', id: 'name', 'name/id': 'name', animal: 'name', code: 'name',
  species: 'species', type: 'species',
  sex: 'sex', gender: 'sex',
  'hatch date': 'dob', hatch: 'dob', hatched: 'dob', dob: 'dob', 'date of birth': 'dob', born: 'dob', hatchdate: 'dob', hatch_date: 'dob',
  'last feed': 'last_feed', 'last feed date': 'last_feed', 'last fed': 'last_feed', last_feed: 'last_feed', 'last feeding': 'last_feed', fed: 'last_feed',
};
const POSITIONAL: (keyof Row)[] = ['name', 'species', 'sex', 'dob', 'last_feed'];

/** existingNames: names already in the user's collection (case-insensitive duplicates are rejected). */
export function parseImport(text: string, dayFirst: boolean, existingNames: string[]): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const firstReal = lines.find(l => l.trim()) ?? '';
  // Separator: tab (pasted from a spreadsheet), then semicolon (European Excel), else comma.
  const sep = firstReal.includes('\t') ? '\t' : !firstReal.includes(',') && firstReal.includes(';') ? ';' : ',';
  let cols = POSITIONAL; let start = 0;
  const firstIdx = lines.findIndex(l => l.trim());
  if (firstIdx >= 0) {
    const h = splitLine(lines[firstIdx], sep).map(c => c.toLowerCase().replace(/\s+/g, ' ').trim());
    if (h.some(c => HEADERS[c] === 'name') && h.some(c => HEADERS[c] === 'species' || HEADERS[c] === 'sex')) {
      cols = h.map(c => HEADERS[c] ?? ('ignore' as keyof Row)); start = firstIdx + 1;
    }
  }
  const existing = new Set(existingNames.map(n => n.trim().toLowerCase()));
  const inFile = new Map<string, number>(); // name -> line it first appeared on
  const rows: Row[] = [];
  for (let i = start; i < lines.length; i++) {
    const raw = lines[i]; if (!raw.trim()) continue;
    const f = splitLine(raw, sep); const v: Record<string, string> = {};
    cols.forEach((c, j) => { if (c && f[j] !== undefined) v[c] = f[j]; });
    const errs: string[] = [];
    const name = (v.name ?? '').trim();
    if (!name) errs.push('Name missing');
    else if (name.length > 60) errs.push('Name longer than 60 characters');
    else if (existing.has(name.toLowerCase())) errs.push(`"${name}" is already in your collection`);
    else if (inFile.has(name.toLowerCase())) errs.push(`Duplicate of line ${inFile.get(name.toLowerCase())}`);
    const species = parseSpecies(v.species ?? '');
    if (!species) errs.push(v.species?.trim() ? `Unknown species "${v.species.trim()}". Use a name from the species list (or Other)` : 'Species missing');
    const sex = parseSex(v.sex ?? '');
    if (!sex) errs.push(v.sex?.trim() ? `Sex "${v.sex.trim()}" should be F, M or U (unknown)` : 'Sex missing');
    const dob = parseDate(v.dob ?? '', dayFirst), lf = parseDate(v.last_feed ?? '', dayFirst);
    if (dob?.startsWith('!')) errs.push('Hatch date: ' + dob.slice(1));
    if (lf?.startsWith('!')) errs.push('Last feed: ' + lf.slice(1));
    if (dob && lf && !dob.startsWith('!') && !lf.startsWith('!') && lf < dob) errs.push('Last feed is before hatch date');
    if (f.length > cols.length && f.slice(cols.length).some(x => x)) errs.push(`Too many columns (expected at most ${cols.length})`);
    if (name && !inFile.has(name.toLowerCase())) inFile.set(name.toLowerCase(), i + 1);
    rows.push({ line: i + 1, raw, name, species: species ?? '', sex: sex ?? '',
      dob: dob && !dob.startsWith('!') ? dob : null, last_feed: lf && !lf.startsWith('!') ? lf : null,
      error: errs.length ? errs.join('; ') : undefined });
  }
  return rows;
}
