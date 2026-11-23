/** After this many seconds the screen says the scan is still running, so a slow read never looks frozen. */
export const STILL_SCANNING_AFTER_S = 12;

export function workingCopy(seconds: number, note?: string | null): { eyebrow: string; title: string } {
  if (note) return { eyebrow: note, title: 'Trying again in a moment.' };
  if (seconds >= 45) return { eyebrow: `Still scanning · ${seconds}s`, title: 'Almost there. Detailed boards take up to a minute and a half.' };
  if (seconds >= STILL_SCANNING_AFTER_S) return { eyebrow: `Still scanning · ${seconds}s`, title: 'Taking a careful look at every part.' };
  return { eyebrow: 'Reading the board', title: 'Looking for fingers, chips, and connectors.' };
}
