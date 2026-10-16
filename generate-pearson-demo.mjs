import { mkdirSync, writeFileSync } from 'node:fs';
import './local-replica/dist/questions.js';
import './local-replica/dist/stats.js';
import './local-replica/dist/pearson.js';

const args = process.argv.slice(2);
let count = 39;
let seed = 20261010;
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (!['--count', '--seed'].includes(flag) || i + 1 >= args.length) {
    throw Error('Usage: node generate-pearson-demo.mjs [--count N] [--seed N]');
  }
  const value = Number(args[++i]);
  if (flag === '--count') count = value;
  else seed = value;
}
if (!Number.isInteger(count) || count < 3 || count > 10000) throw Error('Count must be an integer from 3 to 10000.');
if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('Seed must be an integer from 0 to 4294967295.');

const rows = SurveyStats.generate(count, seed, 'shared', SECTIONS.map(s => s.questions.length)).map(r => r.flat());
const headers = ['DataType', 'TestRespondentID', 'Batch', ...SECTIONS.flatMap(s => s.questions.map(q => `${s.name} [${q}]`))];
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
const csv = [headers, ...rows.map((r, i) => ['SYNTHETIC TEST ONLY', `DEMO-${i + 1}`, `shared; seed=${seed}`, ...r])]
  .map(r => r.map(quote).join(',')).join('\r\n');
const output = new URL('./data/samples/pearson-demo/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('responses.csv', output), '\uFEFF' + csv + '\r\n');
const report = {
  dataType: 'SYNTHETIC TEST ONLY', seed, count, significanceLevel: 0.05,
  note: 'Local demonstration of a simulated association; not research evidence. No selection by p-value.',
  results: PearsonAnalysis.analyze(rows),
};
writeFileSync(new URL('results.json', output), JSON.stringify(report, null, 2) + '\n');
console.log('Created local synthetic demonstration: data/samples/pearson-demo/responses.csv and results.json');
console.log(JSON.stringify(report.results[0], null, 2));
