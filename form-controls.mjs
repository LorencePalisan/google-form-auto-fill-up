import { setTimeout as delay } from 'node:timers/promises';

// Google Forms uses custom ARIA controls. Verify state after the click has
// reached its event handler; a click during initialization may be ignored.
export async function selectChoice(control) {
  await control.waitFor({ state: 'visible' });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await control.isChecked()) return;
    await control.click();
    for (let poll = 0; poll < 5; poll++) {
      if (await control.isChecked()) return;
      await delay(200);
    }
  }
  throw new Error(`Could not select option: ${await control.getAttribute('aria-label') || await control.innerText()}`);
}
