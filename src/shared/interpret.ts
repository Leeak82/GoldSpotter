import { HttpError, isRetryable } from './errors';
import type { Analysis } from './types';
import { parseModelOutput, validateAnalysis } from './validate';

/** Calls the model up to twice when the reply is unreadable, times out, or the provider blips. */
export async function interpretWithRetry(getText: (attempt: number) => Promise<string>): Promise<Analysis> {
  let lastError = 'The vision model returned an unreadable result.';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let text: string;
    try {
      text = await getText(attempt);
    } catch (error) {
      if (!isRetryable(error) || attempt === 1) throw error;
      lastError = error instanceof Error ? error.message : lastError;
      continue;
    }
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
