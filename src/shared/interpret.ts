import { HttpError } from './errors';
import type { Analysis } from './types';
import { parseModelOutput, validateAnalysis } from './validate';

/** Asks once more only when the reply is not valid JSON. Provider errors propagate immediately. */
export async function interpretWithRetry(getText: (attempt: number) => Promise<string>): Promise<Analysis> {
  let lastError = 'The vision model returned an unreadable result.';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await getText(attempt);
    try {
      const result = validateAnalysis(parseModelOutput(text));
      if (result.ok) return result.value;
      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new HttpError(lastError, 502, 'model_failed');
}
