import { runChecks } from '../site/js/checks.js';
import { both } from '../site/js/units.js';
const rows = runChecks();
let g = '';
for (const r of rows) {
  if (r.group !== g) { g = r.group; console.log(`\n== ${g}`); }
  const v = r.value == null ? (r.extra || '') : both(r.value) + (r.extra ? `  (${r.extra})` : '');
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.label} — ${v}  [${r.req}]`);
}
console.log(`\n${rows.filter(r => r.pass).length}/${rows.length} pass`);
