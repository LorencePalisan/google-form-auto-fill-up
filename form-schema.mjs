export function parseFormItems(schema) {
  const questions = schema?.[1]?.[1];
  if (!Array.isArray(questions)) {
    throw new Error('Google Forms question data is missing or has an unsupported structure.');
  }
  const items = questions.filter(q => Array.isArray(q) && q[4] != null);
  if (!items.length) throw new Error('The form contains no supported answer fields.');
  for (const q of items) {
    if (!Array.isArray(q[4]) || !q[4].length) throw new Error('Invalid Google Forms entry list.');
    for (const entry of q[4]) {
      if (!Array.isArray(entry) || !Number.isInteger(entry[0]) ||
          !Array.isArray(entry[1]) || !entry[1].length ||
          entry[1].some(choice => !Array.isArray(choice) || typeof choice[0] !== 'string') ||
          (q[3] === 7 && typeof entry[3]?.[0] !== 'string')) {
        throw new Error('A form question has an unsupported entry or choice structure.');
      }
    }
  }
  return items;
}

export async function readFormItems(page, timeout = 15000) {
  try {
    await page.waitForFunction(() => globalThis.FB_PUBLIC_LOAD_DATA_ != null, null, { timeout });
  } catch (cause) {
    if (page.isClosed() || /Target page, context or browser has been closed/i.test(cause.message || '')) {
      throw new Error('The browser or form tab closed before question data could be read. Keep the automated browser open until the runner finishes. No responses were submitted by this run.', { cause });
    }
    throw new Error('Google Forms did not expose its question data. Check that the configured URL opens a published, accepting-responses form and complete any required sign-in. The page may also be blocked or Google may have changed its format. No responses were submitted by this run.', { cause });
  }
  return parseFormItems(await page.evaluate(() => globalThis.FB_PUBLIC_LOAD_DATA_));
}
