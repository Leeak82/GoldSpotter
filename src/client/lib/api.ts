import type { ScanType } from '../../shared/scanTypes';
import type { Analysis } from '../../shared/types';

type ErrorBody = {
  error?: string;
  code?: string;
};

export async function analyzePhoto(base64: string, mimeType: string, signal: AbortSignal, types: ScanType[]): Promise<Analysis> {
  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType, types }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('The scanner could not be reached. Check your connection and try again.');
  }
  const payload = (await response.json().catch(() => ({}))) as ErrorBody & Partial<Analysis>;
  if (!response.ok) {
    throw new Error(payload.error || 'The scan failed.');
  }
  if (!payload.outcome || !payload.verdict || !Array.isArray(payload.components)) {
    throw new Error('The scanner returned an incomplete result.');
  }
  return payload as Analysis;
}
