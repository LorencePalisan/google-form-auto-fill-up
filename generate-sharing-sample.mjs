import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const respondentCount = 39;
const categories = [
  { label: 'SA', value: 4 },
  { label: 'A', value: 3 },
  { label: 'D', value: 2 },
  { label: 'SD', value: 1 },
];
const targetSets = {
  sharing: {
    label: 'B. Sharing',
    output: 'data/samples/simulated-test-b-sharing.csv',
    frequencies: {
      Q1: [8, 20, 9, 2],
      Q2: [7, 21, 9, 2],
      Q3: [9, 19, 9, 2],
      Q4: [8, 21, 8, 2],
      Q5: [7, 20, 10, 2],
    },
  },
  relationship: {
    label: 'C. Relationship',
    output: 'data/samples/simulated-test-c-relationship.csv',
    frequencies: {
      Q1: [7, 20, 10, 2],
      Q2: [9, 19, 9, 2],
      Q3: [8, 20, 9, 2],
      Q4: [8, 21, 8, 2],
      Q5: [7, 21, 9, 2],
    },
  },
  acquisition: {
    label: 'Customer Acquisition',
    output: 'data/samples/simulated-test-customer-acquisition.csv',
    frequencies: {
      Q1: [12, 14, 7, 6],
      Q2: [5, 19, 9, 6],
      Q3: [11, 16, 7, 5],
      Q4: [11, 18, 7, 3],
      Q5: [12, 20, 4, 3],
      Q6: [10, 17, 10, 2],
      Q7: [5, 20, 9, 5],
      Q8: [6, 18, 11, 4],
    },
  },
};

function parseArgs(args) {
  let seed = 20261010;
  let section = 'sharing';
  let output;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) seed = Number(args[++i]);
    else if (args[i] === '--output' && args[i + 1]) output = args[++i];
    else if (args[i] === '--section' && args[i + 1]) section = args[++i];
    else throw new Error('Usage: node generate-sharing-sample.mjs [--section sharing|relationship|acquisition] [--seed N] [--output FILE]');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('--seed must be an integer from 0 to 4294967295.');
  }
  if (!Object.hasOwn(targetSets, section)) throw new Error('--section must be sharing, relationship, or acquisition.');
  return { seed, section, output: output || targetSets[section].output };
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function sampleVariance(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

function cronbachAlpha(rows, itemNames) {
  const itemVariances = itemNames.map(name => sampleVariance(rows.map(row => row[name])));
  const totalScores = rows.map(row => itemNames.reduce((sum, name) => sum + row[name], 0));
  const totalVariance = sampleVariance(totalScores);
  if (totalVariance === 0) throw new Error('Cronbach’s alpha is undefined because total-score variance is zero.');
  return itemNames.length / (itemNames.length - 1) * (1 - itemVariances.reduce((sum, variance) => sum + variance, 0) / totalVariance);
}

function main() {
  const { seed, section, output } = parseArgs(process.argv.slice(2));
  const { label, frequencies: targets } = targetSets[section];
  const random = makeRandom(seed);
  const itemNames = Object.keys(targets);
  // One shared respondent ordering models a common response tendency across items.
  // Each item's specified category frequencies remain unchanged.
  const respondentOrder = shuffle(Array.from({ length: respondentCount }, (_, index) => index), random);
  for (const name of itemNames) {
    if (targets[name].some(count => !Number.isInteger(count) || count < 0)
      || targets[name].reduce((sum, count) => sum + count, 0) !== respondentCount) {
      throw new Error(`${name} response frequencies must be nonnegative whole numbers totaling exactly ${respondentCount}.`);
    }
  }
  const answersByQuestion = Object.fromEntries(itemNames.map(name => {
    const orderedDeck = targets[name]
      .flatMap((count, categoryIndex) => Array(count).fill(categories[categoryIndex].value))
      .sort((a, b) => b - a);
    const byRespondent = Array(respondentCount);
    respondentOrder.forEach((respondentIndex, rank) => { byRespondent[respondentIndex] = orderedDeck[rank]; });
    return [name, byRespondent];
  }));
  const rows = Array.from({ length: respondentCount }, (_, index) => {
    const row = { Respondent: index + 1 };
    for (const name of itemNames) row[name] = answersByQuestion[name][index];
    return row;
  });

  const destination = resolve(process.cwd(), output);
  const csv = [
    ['Respondent', ...itemNames].join(','),
    ...rows.map(row => [row.Respondent, ...itemNames.map(name => row[name])].join(',')),
  ].join('\n') + '\n';
  writeFileSync(destination, csv, 'utf8');

  console.log(`SIMULATED TEST DATA — ${label}; shared respondent ordering models a common trait. Not actual survey results.`);
  console.log(`Wrote ${respondentCount} respondents to ${destination} (seed ${seed}).\n`);
  console.log('Question | SA n (%)   | A n (%)    | D n (%)    | SD n (%)  | Weighted total');
  console.log('----------|------------|------------|------------|-----------|---------------');
  for (const name of itemNames) {
    const counts = targets[name];
    const cells = counts.map(count => `${String(count).padStart(2)} (${(count / respondentCount * 100).toFixed(2)}%)`);
    const weightedTotal = counts.reduce((total, count, index) => total + count * categories[index].value, 0);
    console.log(`${name.padEnd(9)}| ${cells[0].padEnd(11)}| ${cells[1].padEnd(11)}| ${cells[2].padEnd(11)}| ${cells[3].padEnd(10)}| ${weightedTotal}`);
  }
  console.log(`\nCronbach’s alpha (${itemNames.length} items, respondent-level data): ${cronbachAlpha(rows, itemNames).toFixed(6)}`);
}

main();
