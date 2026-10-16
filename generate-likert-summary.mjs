const respondentCount = 39;
const scaleMaximum = 4;
const maximumPossibleScore = respondentCount * scaleMaximum;
const items = [
  { item: 1, stronglyAgree: 10, agree: 20, disagree: 8, stronglyDisagree: 1, suppliedTotal: 117 },
  { item: 2, stronglyAgree: 12, agree: 18, disagree: 8, stronglyDisagree: 1, suppliedTotal: 118 },
  { item: 3, stronglyAgree: 11, agree: 20, disagree: 7, stronglyDisagree: 1, suppliedTotal: 119 },
  { item: 4, stronglyAgree: 13, agree: 18, disagree: 7, stronglyDisagree: 1, suppliedTotal: 120 },
];

for (const row of items) {
  const responseCount = row.stronglyAgree + row.agree + row.disagree + row.stronglyDisagree;
  if (responseCount !== respondentCount) {
    throw new Error(`Question ${row.item} has ${responseCount} responses; expected exactly ${respondentCount}.`);
  }
  row.weightedTotal = row.stronglyAgree * 4 + row.agree * 3 + row.disagree * 2 + row.stronglyDisagree;
  row.percentage = row.weightedTotal / maximumPossibleScore * 100;
}

console.log('HYPOTHETICAL SAMPLE DATA — not actual survey results.');
console.log(`Respondents per item: ${respondentCount}; maximum possible score: ${maximumPossibleScore}.\n`);
console.log('Item | SA n | A n | D n | SD n | Weighted total | % of maximum');
console.log('-----|------|-----|-----|------|----------------|-------------');
for (const row of items) {
  console.log(
    `${String(row.item).padStart(4)} | ${String(row.stronglyAgree).padStart(4)} | ${String(row.agree).padStart(3)} | ${String(row.disagree).padStart(3)} | ${String(row.stronglyDisagree).padStart(4)} | ${String(row.weightedTotal).padStart(14)} | ${row.percentage.toFixed(2).padStart(10)}%`,
  );
}

const mismatches = items.filter(row => row.suppliedTotal !== row.weightedTotal);
if (mismatches.length) {
  console.log('\nSupplied-total discrepancies (calculated totals use the stated formula):');
  for (const row of mismatches) {
    console.log(`Q${row.item}: supplied ${row.suppliedTotal}; calculated ${row.weightedTotal} (${row.percentage.toFixed(2)}%).`);
  }
}
