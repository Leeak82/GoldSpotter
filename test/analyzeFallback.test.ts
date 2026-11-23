import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { isAiBusy, ScanError } from '../src/client/lib/api';
import {
  analyzeImage,
  clearResultCache,
  DEFAULT_GEMINI_FALLBACKS,
  DEFAULT_GEMINI_MODEL,
  geminiModelChain,
  resetModelCooldowns,
  RESPONSE_SCHEMA,
} from '../src/server/analyze';
import type { PreparedImage } from '../src/server/image';

const image: PreparedImage = {
  mimeType: 'image/jpeg',
  base64: 'abc',
  buffer: Buffer.from('abc'),
};

const good = JSON.stringify({
  board_type: 'Motherboard',
  outcome: 'candidates',
  grade: 'B',
  verdict: 'Worth sorting the fingers and the slot connectors.',
  summary: 'The edge fingers are the likely hotspot.',
  recovery_tips: ['Bag the connectors separately.'],
  components: [
    {
      label: 'PCIe fingers',
      type: 'gold_fingers',
      bbox: [0, 0.8, 0.4, 0.15],
      precious_metals: ['gold'],
      gold_level: 'medium',
      confidence: 'medium',
      why: 'Edge contacts are a likely gold-bearing row.',
    },
  ],
});

beforeEach(() => {
  clearResultCache();
  resetModelCooldowns();
});

test('a missing API key is not treated as a busy AI', () => {
  assert.equal(isAiBusy(new ScanError('Vision analysis is not configured.', 503, 'not_configured')), false);
  assert.equal(isAiBusy(new ScanError('The vision service had an error.', 503, 'model_failed')), true);
  assert.equal(isAiBusy(new ScanError('Too many scans from this connection.', 429, 'rate_limited')), false);
});

test('default chain starts with the stable flash model', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.6-flash');
  assert.deepEqual(geminiModelChain({}), ['gemini-3.6-flash', ...DEFAULT_GEMINI_FALLBACKS.split(',')]);
  assert.deepEqual(geminiModelChain({ GEMINI_MODEL: 'gemini-3.8-flash', GEMINI_FALLBACK_MODELS: 'gemini-3.6-flash' }), [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
  ]);
  // An override still keeps the full flash model ahead of the lite fallbacks.
  assert.deepEqual(geminiModelChain({ GEMINI_MODEL: 'gemini-3.8-flash' }), ['gemini-3.8-flash', 'gemini-3.6-flash', ...DEFAULT_GEMINI_FALLBACKS.split(',')]);
});

test('keeps an unknown read when the sharper pass is rejected', async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  const unknown = JSON.stringify({
    board_type: 'Unknown board',
    outcome: 'unknown',
    grade: '',
    verdict: 'The picture is not clearly a circuit board.',
    summary: 'Not enough of a board is visible.',
    components: [],
  });
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init && typeof init === 'object' && 'body' in init ? init.body : '{}')) as {
      generationConfig?: { mediaResolution?: string };
    };
    calls.push(body.generationConfig?.mediaResolution ?? '');
    if (calls.length === 1) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: unknown }] } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('bad request', { status: 400 });
  };
  try {
    const value = await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold']);
    assert.equal(value.outcome, 'unknown');
    assert.deepEqual(calls, ['MEDIA_RESOLUTION_MEDIUM', 'MEDIA_RESOLUTION_HIGH']);
  } finally {
    globalThis.fetch = original;
  }
});

test('uses the next model after Gemini returns 503', async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    const model = href.includes('gemini-3.6-flash') ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite';
    if (model === 'gemini-3.6-flash') {
      return new Response('The model is overloaded. AIzaTESTKEY', { status: 503 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: good }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const logs: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    const value = await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold']);
    assert.equal(value.grade, 'B');
    assert.equal(value.model, 'gemini-3.5-flash-lite');
    assert.equal(calls.length, 3);
    assert.match(calls[0], /models\/gemini-3\.6-flash:generateContent/);
    assert.match(calls[1], /models\/gemini-3\.6-flash:generateContent/);
    assert.match(calls[2], /models\/gemini-3\.5-flash-lite:generateContent/);
    assert.match(logs.join('\n'), /status=503 model=gemini-3\.6-flash/);
    assert.match(logs.join('\n'), /overloaded/);
    assert.doesNotMatch(logs.join('\n'), /AIzaTESTKEY/);
    await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold']);
    assert.ok(calls.length > 3, 'a lite read is not served from the cache');
  } finally {
    globalThis.fetch = original;
    console.error = originalError;
  }
});

test('the response schema has no empty enum values', () => {
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.enum)) {
      for (const value of record.enum) assert.notEqual(value, '', 'Gemini rejects an empty enum value');
    }
    for (const value of Object.values(record)) walk(value);
  };
  walk(RESPONSE_SCHEMA);
});

test('sends temperature 0 and the schema, and reuses the read for the same photo', async () => {
  let calls = 0;
  let sent: Record<string, unknown> = {};
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    sent = JSON.parse(String(init && typeof init === 'object' && 'body' in init ? init.body : '{}')).generationConfig;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: good }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const first = await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold']);
    const second = await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold']);
    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    assert.equal(sent.temperature, 0);
    assert.ok(sent.responseSchema);
    await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold'], { fresh: true });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('skips a model that ran out of quota on the next scan', async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('gemini-3.8-flash')) return new Response('quota', { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: good }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.8-flash' };
    const first = await analyzeImage(image, env, ['gold']);
    assert.equal(first.model, 'gemini-3.6-flash');
    calls.length = 0;
    await analyzeImage(image, env, ['gold'], { fresh: true });
    assert.equal(calls.length, 1);
    assert.match(calls[0], /gemini-3\.6-flash/);
  } finally {
    globalThis.fetch = original;
    console.error = originalError;
  }
});

test('a busy full model gets a second try before the lite fallback', async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  let flashCalls = 0;
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('gemini-3.6-flash:')) {
      flashCalls += 1;
      if (flashCalls <= 1) return new Response('busy', { status: 503 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: good }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const value = await analyzeImage(image, { GEMINI_API_KEY: 'test-key' }, ['gold']);
    assert.equal(value.model, 'gemini-3.6-flash');
    assert.equal(flashCalls, 2);
    assert.equal(calls.filter((href) => href.includes('lite')).length, 0);
  } finally {
    globalThis.fetch = original;
    console.error = originalError;
  }
});
