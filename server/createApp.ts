import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  getHistoricalAirQualityTrends,
  getLiveAirQualitySnapshot,
} from './services/airQualityBackendService.ts';
import {
  defaultGetGeminiClient,
  handleChatRequest,
  handleRoutineRequest,
  type GeminiClientLike,
} from './services/geminiBackendService.ts';
import {
  resolveGeocodeQuery,
  type GeocodeResultItem,
} from './services/geocodeService.ts';
import type { CacheEntry } from './utils/cache.ts';
import { createJsonFetcher, sanitizePromptText } from './utils/upstream.ts';

export type { GeminiClientLike };

export interface CreateAppOptions {
  getGeminiClient?: () => GeminiClientLike | null;
  fetchFn?: typeof fetch;
  nowFn?: () => number;
  geminiTimeoutMs?: number;
  disableRateLimit?: boolean;
  rateLimitMaxPerMinute?: {
    ai: number;
    data: number;
  };
  allowedOrigins?: string[];
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '512kb' }));

  const getGeminiClient = options.getGeminiClient ?? defaultGetGeminiClient;
  const fetchImpl = options.fetchFn ?? fetch;
  const nowFn = options.nowFn ?? Date.now;
  const geminiTimeoutMs = options.geminiTimeoutMs ?? 25000;
  const rateMax = options.rateLimitMaxPerMinute ?? { ai: 20, data: 60 };
  const fetchJson = createJsonFetcher(fetchImpl);

  const aqCache = new Map<string, CacheEntry<unknown>>();
  const aqHistoryCache = new Map<string, CacheEntry<unknown>>();
  const geocodeCache = new Map<string, CacheEntry<{ results: GeocodeResultItem[] }>>();

  // Bounded sliding-window rate limiter store (IP + bucket -> request timestamps)
  const rateWindowMap = new Map<string, number[]>();
  const RATE_WINDOW_MS = 60 * 1000;

  // Baseline security headers (preserving AI Studio iframe compatibility)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
  });

  // Strict CORS / Origin validation on /api/*
  const configuredAppUrl = process.env.APP_URL?.trim();
  const extraAllowed = options.allowedOrigins ?? [];
  const isOriginAllowed = (origin: string, req: Request): boolean => {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
        return false;
      }
      const host = req.headers.host;
      if (host && parsedOrigin.host === host) {
        return true;
      }
      if (configuredAppUrl) {
        try {
          if (new URL(configuredAppUrl).origin === parsedOrigin.origin) {
            return true;
          }
        } catch {
          // ignore malformed APP_URL
        }
      }
      if (extraAllowed.includes(parsedOrigin.origin)) {
        return true;
      }
      if (
        process.env.NODE_ENV !== 'production' &&
        (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1')
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!isOriginAllowed(origin, req)) {
        res.status(403).json({ error: 'Origin not allowed.' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  // Sliding-window rate limiter on /api/*
  if (!options.disableRateLimit) {
    app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      const isAi = req.path.startsWith('/gemini');
      const limit = isAi ? rateMax.ai : rateMax.data;
      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const bucketKey = `${isAi ? 'ai' : 'data'}:${clientIp}`;
      const now = nowFn();
      const cutoff = now - RATE_WINDOW_MS;

      const existing = (rateWindowMap.get(bucketKey) ?? []).filter((ts) => ts > cutoff);
      if (existing.length >= limit) {
        const retryAfterSec = Math.max(1, Math.ceil((existing[0] + RATE_WINDOW_MS - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        res.status(429).json({
          error: 'Too many requests. Please wait a moment and try again.',
        });
        return;
      }

      existing.push(now);
      if (rateWindowMap.size >= 2000 && !rateWindowMap.has(bucketKey)) {
        const firstKey = rateWindowMap.keys().next().value;
        if (firstKey !== undefined) rateWindowMap.delete(firstKey);
      }
      rateWindowMap.set(bucketKey, existing);
      next();
    });
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      geminiConfigured: Boolean(getGeminiClient()),
      waqiConfigured: Boolean(process.env.WAQI_API_KEY?.trim()),
    });
  });

  app.get('/api/geocode', async (req: Request, res: Response) => {
    try {
      const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const latStr = typeof req.query.lat === 'string' ? req.query.lat.trim() : '';
      const lonStr = typeof req.query.lon === 'string' ? req.query.lon.trim() : '';

      const outcome = await resolveGeocodeQuery({
        qRaw,
        latStr,
        lonStr,
        fetchJson,
        cache: geocodeCache,
        nowFn,
      });
      res.status(outcome.status).json(outcome.body);
    } catch {
      res.status(503).json({ error: 'Location service is temporarily unavailable.' });
    }
  });

  app.get('/api/air-quality', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        res.status(400).json({ error: 'Valid latitude and longitude are required.' });
        return;
      }

      const locationName =
        typeof req.query.name === 'string' && req.query.name.trim()
          ? sanitizePromptText(req.query.name, 120)
          : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      const countryCode =
        typeof req.query.countryCode === 'string'
          ? req.query.countryCode.trim().toUpperCase().slice(0, 8)
          : '';

      const payload = await getLiveAirQualitySnapshot({
        lat,
        lon,
        locationName,
        countryCode,
        fetchJson,
        cache: aqCache,
        nowFn,
      });
      res.json(payload);
    } catch {
      res.status(502).json({
        error: 'Live air quality data is currently unavailable.',
      });
    }
  });

  app.get('/api/air-quality/history', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        res.status(400).json({ error: 'Valid latitude and longitude are required.' });
        return;
      }

      const daysParam = Number(req.query.days);
      const days: 7 | 30 = daysParam === 30 ? 30 : 7;
      const locationName =
        typeof req.query.name === 'string' && req.query.name.trim()
          ? sanitizePromptText(req.query.name, 120)
          : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

      const payload = await getHistoricalAirQualityTrends({
        lat,
        lon,
        days,
        locationName,
        fetchJson,
        cache: aqHistoryCache,
        nowFn,
      });
      res.json(payload);
    } catch {
      res.status(502).json({
        error: 'Historical air quality data is currently unavailable.',
      });
    }
  });

  app.post('/api/gemini/routine', async (req: Request, res: Response) => {
    await handleRoutineRequest({
      ai: getGeminiClient(),
      body: req.body,
      nowFn,
      geminiTimeoutMs,
      res,
    });
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    await handleChatRequest({
      ai: getGeminiClient(),
      body: req.body,
      fetchJson,
      nowFn,
      geminiTimeoutMs,
      res,
    });
  });

  return app;
}
