// Species templates: shared starting values (table species_templates, read-only for users).
// Applying one copies its values into the user's own season_settings; later edits never change the template.
export type Hemisphere = 'south' | 'north';
export type Template = {
  species: string; male_every: number | null; female_every: number | null;
  pause_from: string | null; pause_to: string | null; pair_start: string | null;
  prelay_to_lay: number | null; ovul_to_lay: number | null; lay_to_hatch: number | null; notes: string | null;
};
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // February 28: the date repeats every year

/** Template dates are for the southern hemisphere; the northern seasons are six months apart. */
export function shiftMD(md: string | null, h: Hemisphere): string | null {
  if (!md || h === 'south') return md;
  const m = (+md.slice(0, 2) - 1 + 6) % 12; const d = Math.min(+md.slice(3, 5), DAYS[m]);
  return `${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The season_settings row a template produces for this user. */
export function seasonFromTemplate(t: Template, h: Hemisphere) {
  return { species: t.species, male_every: t.male_every, female_every: t.female_every,
    pause_from: shiftMD(t.pause_from, h), pause_to: shiftMD(t.pause_to, h), pair_start: shiftMD(t.pair_start, h),
    prelay_to_lay: t.prelay_to_lay, ovul_to_lay: t.ovul_to_lay, lay_to_hatch: t.lay_to_hatch };
}

/** Best guess from the phone's timezone (the user confirms it). */
export function guessHemisphere(timeZone: string): Hemisphere {
  return /^(Australia|Pacific\/(Auckland|Chatham|Fiji|Noumea|Tongatapu)|Antarctica|America\/(Sao_Paulo|Argentina|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bogota)|Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka|Lubumbashi|Maseru|Mbabane)|Indian\/(Mauritius|Reunion|Antananarivo))/.test(timeZone) ? 'south' : 'north';
}
