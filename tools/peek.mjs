// Dev: evaluate an expression in the page once it is ready.  node tools/peek.mjs "<url>" "<expression>"
import { withPage } from './cdp.mjs';
const [, , url, expr] = process.argv;
const r = await withPage(url, { evaluate: expr, settle: 0 });
console.log(typeof r.value === 'string' ? r.value : JSON.stringify(r.value, null, 1));
