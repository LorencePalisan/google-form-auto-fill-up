import { parse } from 'csv-parse/sync';

export function readResponses(contents, emailTitle = 'Email') {
  const records = parse(contents, { skip_empty_lines: true, bom: true, trim: true });
  if (!records.length) throw new Error('CSV has no response rows.');
  const emailList = records.every(row => row.length === 1) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(records[0][0]);
  if (emailList) {
    return records.map(([email], index) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`Invalid email format at CSV row ${index + 1}`);
      }
      return { [emailTitle]: email };
    });
  }
  return parse(contents, { columns: true, skip_empty_lines: true, bom: true, trim: true });
}
