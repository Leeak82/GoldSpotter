import { HttpError } from '../shared/errors';
import { interpretWithRetry } from '../shared/interpret';
import { SCAN_TYPES, type ScanType } from '../shared/scanTypes';
import type { Analysis } from '../shared/types';
import type { PreparedImage } from './image';
import { SYSTEM_PROMPT, userPrompt } from './prompt';

const TIMEOUT_MS = 45_000;

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
      const value = await interpretWithRetry((attempt) => callGemini(image, attempt, geminiKey, env.GEMINI_MODEL, types));
      return { ...value, provider: 'gemini' };
    } catch (error) {
      geminiError = error;
      if (!groqKey) throw error;
      console.error('[goldspotter] Gemini failed, trying Groq:', safeError(error));
    }
  }

  try {
    const value = await interpretWithRetry((attempt) => callGroq(image, attempt, groqKey, env.GROQ_MODEL, types));
    return { ...value, provider: 'groq' };
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

async function callGemini(
  image: PreparedImage,
  attempt: number,
  apiKey: string,
  modelName: string | undefined,
  types: ScanType[],
): Promise<string> {
  const model = modelName?.trim() || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response = await postJson(
    url,
    {
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
      generationConfig: generationConfig(true),
    },
    { 'x-goog-api-key': apiKey },
  );

  if (response.status === 400) {
    const detail = await response.text();
    const schemaRejected = /schema|responseMimeType|response_schema/i.test(detail);
    const resolutionRejected = /media.?resolution|unknown field|not supported/i.test(detail);
    if (schemaRejected || resolutionRejected) {
      response = await postJson(
        url,
        {
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
          generationConfig: generationConfig(false, !resolutionRejected),
        },
        { 'x-goog-api-key': apiKey },
      );
    } else {
      throw geminiStatus(response.status, detail);
    }
  }

  if (!response.ok) {
    throw geminiStatus(response.status, await response.text());
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

function generationConfig(withSchema: boolean, withResolution = true): Record<string, unknown> {
  const config: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
  };
  if (withResolution) config.mediaResolution = 'MEDIA_RESOLUTION_HIGH';
  if (withSchema) config.responseSchema = RESPONSE_SCHEMA;
  return config;
}

function geminiStatus(status: number, detail: string): HttpError {
  const clipped = detail.replace(/AIza[\w-]+/g, '[key]').slice(0, 240);
  if (status === 401 || status === 403) {
    return new HttpError('The Gemini API key was rejected.', 401, 'not_configured');
  }
  if (status === 404) {
    return new HttpError('The configured Gemini model was not found. Check GEMINI_MODEL.', 422, 'model_failed');
  }
  if (status === 429) {
    return new HttpError('The vision service is rate limiting requests. Try again shortly.', 429, 'model_failed');
  }
  if (status >= 500) {
    return new HttpError('The vision service had an error. Try the photo again.', status, 'model_failed');
  }
  console.error('[goldspotter] Gemini HTTP', status, clipped);
  return new HttpError('The vision model rejected the photo. Try a clearer JPEG.', 502, 'model_failed');
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

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
