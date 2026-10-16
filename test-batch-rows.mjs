import { normalizeEmail } from './used-emails.mjs';

export function testBatchStatus(source, emails, used) {
  const unique = [...new Set(emails.map(normalizeEmail))];
  const paired = unique.slice(0, source.length);
  return {
    sourceRows: source.length,
    remainingPairedRows: paired.filter(email => !used.has(email)).length,
    unpairedUnusedEmails: unique.slice(source.length).filter(email => !used.has(email)).length,
  };
}

export function selectTestBatch(source, emails, used, limit) {
  if (!source.length) throw new Error('No synthetic answer rows available.');
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limit must be a positive integer.');
  const seen = new Set();
  const rows = [];
  let uniqueIndex = 0;
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    // Keep each email's score row stable across partial runs and restarts.
    // Each source row may be assigned only once; never wrap back to the pilot.
    const answers = source[uniqueIndex++];
    if (used.has(normalized)) continue;
    if (!answers) throw new Error('Synthetic source exhausted. Refusing to recycle pilot/test patterns. No batch selected; do not use generated responses as final research data.');
    rows.push({ answers, email });
    if (rows.length === limit) break;
  }
  if (rows.length < limit) throw new Error(`Only ${rows.length} unused paired test rows remain; requested ${limit}. No batch selected.`);
  return rows;
}
