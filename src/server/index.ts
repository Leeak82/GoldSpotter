import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { HttpError } from '../shared/errors';
import { createRateLimiter } from '../shared/rateLimit';
import { parseScanTypes } from '../shared/scanTypes';
import { analyzeImage } from './analyze';
import { decodeImagePayload } from './image';

const PORT = Number(process.env.PORT) || 8787;
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const limiter = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS);
const clientDir = path.join(__dirname, '../client');

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'goldspotter' });
});

app.post(
  '/api/analyze',
  express.json({ limit: '9mb' }),
  async (req, res, next) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!limiter.allow(ip)) {
        res.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
        res.status(429).json({
          error: 'Too many scans from this connection. Wait a few minutes and try again.',
          code: 'rate_limited',
        });
        return;
      }
      const image = decodeImagePayload(req.body);
      const requested = (req.body as { types?: unknown }).types;
      const types = parseScanTypes(requested);
      if (Array.isArray(requested) && types.length === 0) {
        res.status(400).json({ error: 'Leave at least one scan type on.', code: 'bad_types' });
        return;
      }
      const started = Date.now();
      const analysis = await analyzeImage(image, process.env, types);
      console.info(
        `[goldspotter] analyzed provider=${analysis.provider} grade=${analysis.grade} parts=${analysis.components.length} ms=${Date.now() - started}`,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  },
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'That API route does not exist.', code: 'not_found' });
});

app.use(
  express.static(clientDir, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }
  res.sendFile(path.join(clientDir, 'index.html'), (error) => {
    if (error) next();
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isPayloadTooLarge(error)) {
    res.status(413).json({
      error: 'That photo is too large. Let the app compress it, or choose a smaller image.',
      code: 'image_too_large',
    });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'The upload was not valid JSON.', code: 'bad_image' });
    return;
  }
  if (error instanceof HttpError) {
    if (error.statusCode >= 500) console.error('[goldspotter]', error.statusCode, error.message);
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  console.error('[goldspotter] unexpected', error);
  res.status(500).json({ error: 'Something went wrong reading that photo.', code: 'model_failed' });
});

function isPayloadTooLarge(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'type' in error && (error as { type?: string }).type === 'entity.too.large');
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.info(`GoldSpotter listening on 0.0.0.0:${PORT}`);
  });
}
