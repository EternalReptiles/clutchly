// Copies the app's pure rule files (lib/logic.ts, lib/species.ts) into the daily-digest Edge Function,
// rewriting imports for Deno (which needs explicit .ts extensions). Run after changing either file:
//   node scripts/sync_function_shared.mjs          (writes)
//   node scripts/sync_function_shared.mjs --check  (fails if the copies are out of date)
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'supabase/functions/daily-digest/shared');
const header = '// GENERATED from lib/ by scripts/sync_function_shared.mjs. Do not edit here.\n';
const files = { 'logic.ts': 'lib/logic.ts', 'species.ts': 'lib/species.ts' };
let stale = false;
for (const [name, src] of Object.entries(files)) {
  const out = header + fs.readFileSync(path.join(root, src), 'utf8').replace(/from '\.\/species'/g, "from './species.ts'");
  const dest = path.join(outDir, name);
  if (process.argv.includes('--check')) { if (!fs.existsSync(dest) || fs.readFileSync(dest, 'utf8') !== out) { console.error(`${dest} is out of date`); stale = true; } }
  else { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(dest, out); console.log('wrote', path.relative(root, dest)); }
}
process.exit(stale ? 1 : 0);
