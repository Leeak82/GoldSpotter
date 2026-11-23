import { HttpError } from '../shared/errors';
import { interpretWithRetry } from '../shared/interpret';
import { SCAN_TYPES, type ScanType } from '../shared/scanTypes';
import type { Analysis } from '../shared/types';
import type { PreparedImage } from './image';
import { SYSTEM_PROMPT, userPrompt } from './prompt';

const CALL_TIMEOUT_MS = 25_000;
const OVERALL_TIMEOUT_MS = 75_000;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
export const DEFAULT_GEMINI_FALLBACKS = 'gemini-3.5-flash-lite,gemini-3.1-flash-lite';

type MediaLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export function geminiModelChain(env: NodeJS.ProcessEnv): string[] {
  const primary = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const configured = env.GEMINI_FALLBACK_MODELS === undefined ? DEFAULT_GEMINI_FALLBACKS : env.GEMINI_FALLBACK_MODELS;
  const names = [primary, ...configured.split(',')];
  const seen = new Set<string>();
  const chain: string[] = [];
  for (const name of names) {
    const model = name.trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    chain.push(model);
  }
  return chain;
}

function mediaLevel(env: NodeJS.ProcessEnv): MediaLevel {
  const raw = env.GEMINI_MEDIA_RESOLUTION?.trim().toUpperCase();
  if (raw === 'LOW' || raw === 'MEDIUM' || raw === 'HIGH') return raw;
  return 'MEDIUM';
}

export async function analyzeImage(
  image: PreparedImage,
  env: NodeJS.ProcessEnv = process.env,
  types: ScanType[] = [...SCAN_TYPES],
): Promise<Analysis> {
  const geminiKey = env.GEMINI_API_KEY?.trim() ?? '';
  const groqKey = env.GROQ_API_KEY?.trim() ?? '';
  if (!geminiKey && !groqKey) {
    throw new HttpError(
      'Vision analysis is not configured. Add GEMINI_API_KEY (or GROQ_API_KEY) on the server and redeploy.',
      503,
      'not_configured',
    );
  }

  let geminiError: unknown;
  if (geminiKey) {
    try {
      return await analyzeWithGemini(image, env, geminiKey, types);
    } catch (error) {
      geminiError = error;
      if (!groqKey) throw error;
      console.error('[goldspotter] Gemini failed, trying Groq:', safeError(error));
    }
  }

  try {
    const value = await interpretWithRetry((attempt) => callGroq(image, attempt, groqKey, env.GROQ_MODEL, types));
    return { ...value, provider: 'groq', model: env.GROQ_MODEL?.trim() || 'qwen/qwen3.8-27b' };
  } catch (error) {
    if (geminiError) {
      throw new HttpError(
        'Both vision providers failed. Check GEMINI_API_KEY, GEMINI_MODEL, and GROQ_API_KEY.',
        502,
        'model_failed',
      );
    }
    throw error;
  }
}

async function analyzeWithGemini(
  image: PreparedImage,
  env: NodeJS.ProcessEnv,
  apiKey: string,
  types: ScanType[],
): Promise<Analysis> {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  const resolution = mediaLevel(env);
  const models = geminiModelChain(env);
  let lastError: unknown = new HttpError('The vision service had an error. Try the photo again.', 503, 'model_failed');
  for (let index = 0; index < models.length; index += 1) {
    if (Date.now() >= deadline) break;
    if (index > 0) {
      const wait = Math.min(backoffMs(index), deadline - Date.now());
      if (wait <= 0) break;
      await sleep(wait);
    }
    const model = models[index];
    try {
      let analysis = await interpretWithRetry((attempt) => callGemini(image, attempt, apiKey, model, types, resolution, deadline));
      if (analysis.outcome === 'unknown' && resolution !== 'HIGH' && deadline - Date.now() > 1_000) {
        try {
          analysis = await interpretWithRetry((attempt) => callGemini(image, attempt, apiKey, model, types, 'HIGH', deadline));
        } catch (error) {
          if (!shouldAdvance(error)) throw error;
        }
      }
      return { ...analysis, provider: 'gemini', model };
    } catch (error) {
      lastError = error;
      if (!shouldAdvance(error) || index === models.length - 1) throw error;
    }
  }
  throw lastError;
}

function shouldAdvance(error: unknown): boolean {
  return error instanceof HttpError && (error.statusCode === 429 || error.statusCode >= 500);
}

function backoffMs(step: number): number {
  const base = step <= 1 ? 1_000 : 2_000;
  return base + Math.floor(Math.random() * 200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  image: PreparedImage,
  attempt: number,
  apiKey: string,
  model: string,
  types: ScanType[],
  resolution: MediaLevel,
  deadline: number,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const timeout = Math.min(CALL_TIMEOUT_MS, deadline - Date.now());
  let response = await postJson(
    url,
    geminiBody(image, attempt, types, generationConfig(true, resolution)),
    { 'x-goog-api-key': apiKey },
    timeout,
  );

  if (response.status === 400) {
    const detail = await geminiErrorBody(response, model);
    const schemaRejected = /schema|responseMimeType|response_schema/i.test(detail);
    const resolutionRejected = /media.?resolution|unknown field|not supported/i.test(detail);
    if (schemaRejected || resolutionRejected) {
      response = await postJson(
        url,
        geminiBody(image, attempt, types, generationConfig(false, resolutionRejected ? null : resolution)),
        { 'x-goog-api-key': apiKey },
        Math.min(CALL_TIMEOUT_MS, deadline - Date.now()),
      );
    } else {
      throw geminiStatus(response.status);
    }
  }

  if (!response.ok) {
    await geminiErrorBody(response, model);
    throw geminiStatus(response.status);
  }
  const payload = (await response.json()) as GeminiResponse;
  if (payload.promptFeedback?.blockReason) {
    throw new HttpError('The vision model declined this image.', 422, 'model_failed');
  }
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join('\n')
    .trim();
  if (!text) throw new HttpError('The vision model returned an empty answer.', 502, 'model_failed');
  return text;
}

function geminiBody(image: PreparedImage, attempt: number, types: ScanType[], generationConfig: Record<string, unknown>) {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt(attempt, types) },
          { inlineData: { mimeType: image.mimeType, data: image.base64 } },
        ],
      },
    ],
    generationConfig,
  };
}

function generationConfig(withSchema: boolean, resolution: MediaLevel | null): Record<string, unknown> {
  const config: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
  };
  if (resolution) config.mediaResolution = `MEDIA_RESOLUTION_${resolution}`;
  if (withSchema) config.responseSchema = RESPONSE_SCHEMA;
  return config;
}

async function geminiErrorBody(response: Response, model: string): Promise<string> {
  const detail = (await response.text()).replace(/AIza[\w-]+/g, '[key]');
  console.error(`[goldspotter] Gemini HTTP status=${response.status} model=${model} body=${detail.slice(0, 240)}`);
  return detail;
}

function geminiStatus(status: number): HttpError {
  if (status === 401 || status === 403) {
    return new HttpError('The Gemini API key was rejected.', 401, 'not_configured');
  }
  if (status === 404) {
    return new HttpError('The configured Gemini model was not found. Check GEMINI_MODEL.', 422, 'model_failed');
  }
  if (status === 429) {
    return new HttpError('The vision service is rate limiting requests. Try again shortly.', 429, 'model_failed');
  }
  if (status === 504 || status === 408) {
    return new HttpError('The vision model timed out. Try a clearer, closer photo.', 504, 'timeout');
  }
  if (status >= 500) {
    return new HttpError('The vision service had an error. Try the photo again.', status, 'model_failed');
  }
  return new HttpError('The vision model rejected the photo. Try a clearer JPEG.', status, 'model_failed');
}

async function callGroq(
  image: PreparedImage,
  attempt: number,
  apiKey: string,
  modelName: string | undefined,
  types: ScanType[],
): Promise<string> {
  const model = modelName?.trim() || 'qwen/qwen3.8-27b';
  const response = await postJson(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      temperature: 0.2,
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt(attempt, types) },
            { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
          ],
        },
      ],
    },
    { Authorization: `Bearer ${apiKey}` },
  );
  if (!response.ok) {
    const detail = (await response.text()).replace(/gsk_[\w-]+/g, '[key]').slice(0, 240);
    if (response.status === 401 || response.status === 403) {
      throw new HttpError('The Groq API key was rejected.', 401, 'not_configured');
    }
    if (response.status === 404 || response.status === 400) {
      console.error('[goldspotter] Groq HTTP', response.status, detail);
      throw new HttpError('The configured Groq vision model was rejected. Check GROQ_MODEL.', 422, 'model_failed');
    }
    if (response.status === 429) {
      throw new HttpError('The backup vision service is rate limiting requests.', 429, 'model_failed');
    }
    throw new HttpError('The backup vision service failed.', 502, 'model_failed');
  }
  const payload = (await response.json()) as GroqResponse;
  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((part) => part.text ?? '').join('\n') : '';
  if (!text.trim()) throw new HttpError('The backup vision model returned an empty answer.', 502, 'model_failed');
  return text;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = CALL_TIMEOUT_MS): Promise<Response> {
  if (timeoutMs <= 0) {
    throw new HttpError('The vision model timed out. Try a clearer, closer photo.', 504, 'timeout');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError('The vision model timed out. Try a clearer, closer photo.', 504, 'timeout');
    }
    throw new HttpError('Could not reach the vision service.', 502, 'model_failed');
  } finally {
    clearTimeout(timer);
  }
}

function safeError(error: unknown): string {
  if (error instanceof HttpError) return `${error.statusCode} ${error.message}`;
  return error instanceof Error ? error.message : 'unknown error';
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    board_type: { type: 'string' },
    outcome: { type: 'string', enum: ['candidates', 'unknown', 'bad_photo'] },
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D', ''] },
    verdict: { type: 'string' },
    summary: { type: 'string' },
    recovery_tips: { type: 'array', items: { type: 'string' } },
    retake_tips: { type: 'array', items: { type: 'string' } },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'cpu_processor',
              'ram_chip',
              'gold_fingers',
              'pin_connector',
              'ic_chip',
              'mlcc',
              'tantalum_capacitor',
              'relay',
              'crystal_oscillator',
              'gold_plated_pads',
              'plated_through_hole',
              'other',
            ],
          },
          bbox: { type: 'array', items: { type: 'number' } },
          precious_metals: { type: 'array', items: { type: 'string' } },
          gold_level: { type: 'string', enum: ['high', 'medium', 'low', 'none'] },
          value_potential: { type: 'string', enum: ['high', 'medium', 'low'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          why: { type: 'string' },
        },
        required: ['label', 'type', 'bbox', 'precious_metals', 'gold_level', 'value_potential', 'confidence', 'why'],
      },
    },
  },
  required: ['board_type', 'outcome', 'verdict', 'summary', 'recovery_tips', 'retake_tips', 'components'],
};

type GeminiResponse = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
};

type GroqResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
};
