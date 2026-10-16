import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const normalizeEmail = email => email.trim().toLowerCase();

export function loadUsedEmails(path) {
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
  if (!Array.isArray(data) || data.some(email => typeof email !== 'string')) {
    throw new Error(`Invalid email history: ${path}`);
  }
  return new Set(data.map(normalizeEmail));
}

export function selectUnused(rows, emailTitle, used, limit) {
  const seen = new Set(used);
  return rows.filter(row => {
    if (!row[emailTitle]) throw new Error(`Missing email column "${emailTitle}". Use --email-title to specify its header.`);
    const email = normalizeEmail(row[emailTitle]);
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  }).slice(0, limit);
}

export function saveUsedEmail(path, email) {
  if (path instanceof URL) path = fileURLToPath(path);
  const used = loadUsedEmails(path);
  used.add(normalizeEmail(email));
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify([...used], null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, path);
}
