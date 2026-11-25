import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  computeIndianNaqi,
  toFiniteNumber,
  toNonNegativeNumber,
} from '../src/utils/aqi.ts';

export interface GeminiClientLike {
  models: {
    generateContent: (args: Record<string, unknown>) => Promise<{
      text?: string;
      functionCalls?: Array<{
        name?: string;
        id?: string;
        args?: Record<string, unknown>;
      }>;
      candidates?: Array<{ content?: unknown }>;
    }>;
    generateContentStream: (args: Record<string, unknown>) => Promise<
      AsyncIterable<{
        text?: string;
      }>
    >;
  };
}

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

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_CACHE_ENTRIES = 500;

function setBoundedCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  nowMs: number
): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { value, expiresAt: nowMs + ttlMs });
}

function getValidCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  nowMs: number
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function defaultGetGeminiClient(): GeminiClientLike | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  }) as unknown as GeminiClientLike;
}

function weatherCodeToLabel(code: number | null): string {
  if (code === null) return 'Conditions unknown';
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Fog / mist';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}

function sanitizePromptText(value: unknown, maxLen = 100): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t\x00-\x1f\x7f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

type UpstreamErrorCategory = 'NETWORK' | 'HTTP_ERROR' | 'UPSTREAM_HTML' | 'INVALID_JSON';

class UpstreamServiceError extends Error {
  readonly category: UpstreamErrorCategory;
  readonly statusCode?: number;

  constructor(category: UpstreamErrorCategory, message: string, statusCode?: number) {
    super(message);
    this.name = 'UpstreamServiceError';
    this.category = category;
    this.statusCode = statusCode;
  }
}

class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

function looksLikeHtmlOrNonJson(rawText: string, contentType: string): boolean {
  const lowerCt = contentType.toLowerCase();
  if (lowerCt.includes('text/html') || lowerCt.includes('application/xhtml')) {
    return true;
  }
  const trimmed = rawText.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('<') || /^<!doctype/i.test(trimmed) || /^the page /i.test(trimmed)) {
    return true;
  }
  return !trimmed.startsWith('{') && !trimmed.startsWith('[');
}

function parseUpstreamJsonText(rawText: string, contentType = ''): unknown {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new UpstreamServiceError('INVALID_JSON', 'Upstream returned an empty response');
  }
  if (looksLikeHtmlOrNonJson(trimmed, contentType)) {
    throw new UpstreamServiceError('UPSTREAM_HTML', 'Upstream returned HTML or non-JSON content');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new UpstreamServiceError('INVALID_JSON', 'Upstream returned malformed JSON');
  }
}

function stripMarkdownJsonFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
  return trimmed;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new RequestTimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  const getGeminiClient = options.getGeminiClient ?? defaultGetGeminiClient;
  const fetchImpl = options.fetchFn ?? fetch;
  const nowFn = options.nowFn ?? Date.now;
  const geminiTimeoutMs = options.geminiTimeoutMs ?? 25000;
  const rateMax = options.rateLimitMaxPerMinute ?? { ai: 20, data: 60 };

  const aqCache = new Map<string, CacheEntry<unknown>>();
  const AQ_CACHE_TTL_MS = 10 * 60 * 1000;
  const aqHistoryCache = new Map<string, CacheEntry<unknown>>();
  const AQ_HISTORY_CACHE_TTL_MS = 30 * 60 * 1000;
  const geocodeCache = new Map<string, CacheEntry<unknown>>();
  const GEOCODE_CACHE_TTL_MS = 15 * 60 * 1000;

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

  async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: globalThis.Response;
      try {
        res = await fetchImpl(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'HAWA-JANO/1.0',
            Accept: 'application/json',
          },
        });
      } catch (err) {
        const reason =
          err instanceof Error && err.name === 'AbortError'
            ? 'Upstream request timed out'
            : 'Network error reaching upstream service';
        throw new UpstreamServiceError('NETWORK', reason);
      }

      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();

      if (!res.ok) {
        if (looksLikeHtmlOrNonJson(rawText, contentType)) {
          throw new UpstreamServiceError(
            'UPSTREAM_HTML',
            `Upstream returned HTTP ${res.status} HTML error page`,
            res.status
          );
        }
        throw new UpstreamServiceError('HTTP_ERROR', `Upstream HTTP ${res.status}`, res.status);
      }

      return parseUpstreamJsonText(rawText, contentType);
    } finally {
      clearTimeout(timer);
    }
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      geminiConfigured: Boolean(getGeminiClient()),
      waqiConfigured: Boolean(process.env.WAQI_API_KEY?.trim()),
    });
  });

  // Geocode endpoint: Indian 6-digit PIN codes, city names, or reverse geocoding
  app.get('/api/geocode', async (req: Request, res: Response) => {
    try {
      const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const q = qRaw.slice(0, 100);
      const latStr = typeof req.query.lat === 'string' ? req.query.lat.trim() : '';
      const lonStr = typeof req.query.lon === 'string' ? req.query.lon.trim() : '';

      if (qRaw.length > 100) {
        res.status(400).json({ error: 'Location search query is too long.' });
        return;
      }

      // Reverse geocoding from browser coordinates
      if (latStr && lonStr) {
        const lat = Number(latStr);
        const lon = Number(lonStr);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          res.status(400).json({ error: 'Invalid coordinates provided.' });
          return;
        }
        const revKey = `rev:${lat.toFixed(3)},${lon.toFixed(3)}`;
        const cached = getValidCache(geocodeCache, revKey, nowFn());
        if (cached) {
          res.json(cached);
          return;
        }

        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lon)}&zoom=12&addressdetails=1`;
        const data = (await fetchJsonWithTimeout(url, 8000)) as {
          address?: Record<string, string>;
          display_name?: string;
        };
        const addr = data.address ?? {};
        const city =
          addr.city ||
          addr.town ||
          addr.suburb ||
          addr.city_district ||
          addr.county ||
          addr.state_district ||
          'Current Location';
        const district = addr.state_district || addr.county || addr.city_district || '';
        const region = addr.state || addr.region || '';
        const country = addr.country || 'Unknown';
        const countryCode = (addr.country_code || '').toUpperCase();
        const pinCode = addr.postcode || undefined;

        const payload = {
          results: [
            {
              name: region ? `${city}, ${region}` : city,
              city,
              district,
              region,
              country,
              countryCode,
              pinCode,
              latitude: lat,
              longitude: lon,
            },
          ],
        };
        setBoundedCache(geocodeCache, revKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
        res.json(payload);
        return;
      }

      if (!q) {
        res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
        return;
      }

      // Enforce exact 6-digit Indian PIN code validation for numeric queries
      if (/^\d+$/.test(q)) {
        if (!/^\d{6}$/.test(q)) {
          res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
          return;
        }

        const pinKey = `pin:${q}`;
        const cachedPin = getValidCache(geocodeCache, pinKey, nowFn());
        if (cachedPin) {
          res.json(cachedPin);
          return;
        }

        interface IndiaPostOffice {
          Name?: string;
          BranchType?: string;
          Block?: string;
          District?: string;
          State?: string;
          Country?: string;
        }
        interface IndiaPostEntry {
          Status?: string;
          PostOffice?: IndiaPostOffice[] | null;
        }
        interface NominatimItem {
          lat: string;
          lon: string;
          display_name: string;
          address?: Record<string, string>;
        }

        const postalUrl = `https://api.postalpincode.in/pincode/${encodeURIComponent(q)}`;
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&postalcode=${encodeURIComponent(
          q
        )}&countrycodes=in&addressdetails=1&limit=5`;

        const [postalSettled, nomSettled] = await Promise.allSettled([
          fetchJsonWithTimeout(postalUrl, 8000) as Promise<IndiaPostEntry[]>,
          fetchJsonWithTimeout(nomUrl, 8000) as Promise<NominatimItem[]>,
        ]);

        let postalSuccess = false;
        let postalNotFound = false;
        let primaryPo: IndiaPostOffice | null = null;

        if (postalSettled.status === 'fulfilled' && Array.isArray(postalSettled.value)) {
          const firstEntry = postalSettled.value[0];
          if (
            firstEntry?.Status === 'Success' &&
            Array.isArray(firstEntry.PostOffice) &&
            firstEntry.PostOffice.length > 0
          ) {
            postalSuccess = true;
            primaryPo =
              firstEntry.PostOffice.find((p) => p.BranchType === 'Head Post Office') ||
              firstEntry.PostOffice.find((p) => p.BranchType === 'Sub Post Office') ||
              firstEntry.PostOffice[0];
          } else if (firstEntry?.Status === 'Error' || firstEntry?.Status === '404') {
            postalNotFound = true;
          }
        }

        const nomItems =
          nomSettled.status === 'fulfilled' && Array.isArray(nomSettled.value)
            ? nomSettled.value
            : [];
        const nomResolvedCleanly = nomSettled.status === 'fulfilled';

        const validNomCoords = nomItems
          .map((item) => ({
            lat: Number(item.lat),
            lon: Number(item.lon),
            addr: item.address ?? {},
          }))
          .find((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

        // 1. Primary path: India Post returned verified city, district, state, country
        if (postalSuccess && primaryPo) {
          const district = (primaryPo.District || '').trim();
          const region = (primaryPo.State || '').trim();
          const country = (primaryPo.Country || 'India').trim();
          const block =
            primaryPo.Block && primaryPo.Block !== 'NA' ? primaryPo.Block.trim() : '';
          const poName = (primaryPo.Name || '').trim();
          const city = block || district || poName || q;

          let latitude = validNomCoords?.lat ?? NaN;
          let longitude = validNomCoords?.lon ?? NaN;

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            const coordQueries = [
              [city, region].filter(Boolean).join(', '),
              [district, region].filter(Boolean).join(', '),
              district,
            ].filter(Boolean);

            for (const cq of coordQueries) {
              try {
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                  cq
                )}&count=3&language=en&format=json&countryCode=IN`;
                const geoData = (await fetchJsonWithTimeout(geoUrl, 6000)) as {
                  results?: Array<{ latitude: number; longitude: number; country_code?: string }>;
                };
                const match = (geoData.results ?? []).find(
                  (r) =>
                    Number.isFinite(r.latitude) &&
                    Number.isFinite(r.longitude) &&
                    (!r.country_code || r.country_code.toUpperCase() === 'IN')
                );
                if (match) {
                  latitude = match.latitude;
                  longitude = match.longitude;
                  break;
                }
              } catch {
                // Try next coordinate query
              }
            }
          }

          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            const displayLabel =
              city && region && city.toLowerCase() !== region.toLowerCase()
                ? `${city}, ${region} (${q})`
                : `${city} (${q})`;

            const payload = {
              results: [
                {
                  name: displayLabel,
                  city,
                  district,
                  region,
                  country,
                  countryCode: 'IN',
                  pinCode: q,
                  latitude,
                  longitude,
                },
              ],
            };
            setBoundedCache(geocodeCache, pinKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
            res.json(payload);
            return;
          }
        }

        // 2. Fallback path: Nominatim returned valid Indian postal coordinates directly
        if (nomItems.length > 0 && !postalNotFound) {
          const results = nomItems
            .map((item) => {
              const lat = Number(item.lat);
              const lon = Number(item.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              const addr = item.address ?? {};
              const city =
                addr.city ||
                addr.town ||
                addr.village ||
                addr.suburb ||
                addr.state_district ||
                addr.county ||
                q;
              const district = addr.state_district || addr.county || addr.city_district || '';
              const region = addr.state || '';
              const country = addr.country || 'India';
              const countryCode = (addr.country_code || 'IN').toUpperCase();
              return {
                name: region ? `${city}, ${region} (${q})` : `${city} (${q})`,
                city,
                district,
                region,
                country,
                countryCode,
                pinCode: q,
                latitude: lat,
                longitude: lon,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

          if (results.length > 0) {
            const payload = { results };
            setBoundedCache(geocodeCache, pinKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
            res.json(payload);
            return;
          }
        }

        // 3. Clean "no match found" if providers answered cleanly saying no such PIN
        if (
          postalNotFound ||
          (nomResolvedCleanly && nomItems.length === 0 && postalSettled.status === 'fulfilled')
        ) {
          res.json({ results: [] });
          return;
        }

        res.status(503).json({
          error: 'Location service is temporarily unavailable.',
        });
        return;
      }

      if (q.length < 2) {
        res.status(400).json({ error: 'Enter at least 2 characters for city or PIN code.' });
        return;
      }

      const cityKey = `city:${q.toLowerCase()}`;
      const cachedCity = getValidCache(geocodeCache, cityKey, nowFn());
      if (cachedCity) {
        res.json(cachedCity);
        return;
      }

      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=6&language=en&format=json`;
      const geoData = (await fetchJsonWithTimeout(geoUrl, 8000)) as {
        results?: Array<{
          name: string;
          admin1?: string;
          admin2?: string;
          country?: string;
          country_code?: string;
          latitude: number;
          longitude: number;
        }>;
      };

      const results = (geoData.results ?? []).map((r) => ({
        name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
        city: r.name,
        district: r.admin2 || '',
        region: r.admin1 || '',
        country: r.country || '',
        countryCode: (r.country_code || '').toUpperCase(),
        latitude: r.latitude,
        longitude: r.longitude,
      }));

      const payload = { results };
      setBoundedCache(geocodeCache, cityKey, payload, GEOCODE_CACHE_TTL_MS, nowFn());
      res.json(payload);
    } catch {
      res.status(503).json({ error: 'Location service is temporarily unavailable.' });
    }
  });

  // Live Air Quality + Weather proxy
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

      const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      const cached = getValidCache(aqCache, cacheKey, nowFn());
      if (cached) {
        res.json(cached);
        return;
      }

      const aqUrl =
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi` +
        `&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,us_aqi` +
        `&past_days=1&forecast_days=2&timezone=auto`;

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day` +
        `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m` +
        `&past_days=1&forecast_days=2&timezone=auto`;

      const [aqRaw, weatherRaw] = await Promise.all([
        fetchJsonWithTimeout(aqUrl, 10000) as Promise<{
          current?: Record<string, unknown>;
          hourly?: Record<string, unknown[]>;
        }>,
        fetchJsonWithTimeout(weatherUrl, 10000) as Promise<{
          current?: Record<string, unknown>;
          hourly?: Record<string, unknown[]>;
        }>,
      ]);

      const aqCur = aqRaw.current ?? {};
      const wCur = weatherRaw.current ?? {};

      const pollutants = {
        pm25: toNonNegativeNumber(aqCur.pm2_5),
        pm10: toNonNegativeNumber(aqCur.pm10),
        no2: toNonNegativeNumber(aqCur.nitrogen_dioxide),
        o3: toNonNegativeNumber(aqCur.ozone),
        co: toNonNegativeNumber(aqCur.carbon_monoxide),
        so2: toNonNegativeNumber(aqCur.sulphur_dioxide),
      };

      let usAqiValue = toNonNegativeNumber(aqCur.us_aqi);
      let sourceLabel = 'Open-Meteo Copernicus CAMS & Weather';
      let stationName: string | undefined;
      let measuredAt =
        typeof aqCur.time === 'string' && aqCur.time.trim()
          ? aqCur.time
          : new Date(nowFn()).toISOString();

      const waqiToken = process.env.WAQI_API_KEY?.trim();
      if (waqiToken) {
        try {
          const waqiUrl = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${encodeURIComponent(
            waqiToken
          )}`;
          const waqiRes = (await fetchJsonWithTimeout(waqiUrl, 5000)) as {
            status?: string;
            data?: {
              aqi?: number;
              city?: { name?: string };
              time?: { iso?: string };
            };
          };
          if (waqiRes.status === 'ok' && waqiRes.data) {
            stationName = waqiRes.data.city?.name || undefined;
            const waqiAqi = toNonNegativeNumber(waqiRes.data.aqi);
            if (waqiAqi !== null) {
              usAqiValue = waqiAqi;
            }
            if (waqiRes.data.time?.iso) {
              measuredAt = waqiRes.data.time.iso;
            }
            if (stationName) {
              sourceLabel = 'WAQI Monitoring Station + Open-Meteo Forecast';
            }
          }
        } catch {
          // Non-fatal: continue with Open-Meteo CAMS data
        }
      }

      const inNaqi = computeIndianNaqi(pollutants);
      const usDominant =
        pollutants.pm25 !== null && pollutants.pm10 !== null
          ? pollutants.pm25 >= pollutants.pm10 * 0.45
            ? 'PM2.5'
            : 'PM10'
          : pollutants.pm25 !== null
            ? 'PM2.5'
            : null;

      const aqHourly = aqRaw.hourly ?? {};
      const wHourly = weatherRaw.hourly ?? {};
      const times = Array.isArray(aqHourly.time) ? (aqHourly.time as string[]) : [];
      const pm25Arr = Array.isArray(aqHourly.pm2_5) ? aqHourly.pm2_5 : [];
      const pm10Arr = Array.isArray(aqHourly.pm10) ? aqHourly.pm10 : [];
      const no2Arr = Array.isArray(aqHourly.nitrogen_dioxide) ? aqHourly.nitrogen_dioxide : [];
      const o3Arr = Array.isArray(aqHourly.ozone) ? aqHourly.ozone : [];
      const coArr = Array.isArray(aqHourly.carbon_monoxide) ? aqHourly.carbon_monoxide : [];
      const usAqiArr = Array.isArray(aqHourly.us_aqi) ? aqHourly.us_aqi : [];
      const tempArr = Array.isArray(wHourly.temperature_2m) ? wHourly.temperature_2m : [];
      const humArr = Array.isArray(wHourly.relative_humidity_2m) ? wHourly.relative_humidity_2m : [];
      const windArr = Array.isArray(wHourly.wind_speed_10m) ? wHourly.wind_speed_10m : [];

      const curIsoPrefix = measuredAt.slice(0, 13);
      let curIdx = times.findIndex((t) => typeof t === 'string' && t.startsWith(curIsoPrefix));
      if (curIdx === -1) {
        curIdx = Math.min(24, Math.max(0, times.length - 1));
      }

      const startIdx = Math.max(0, curIdx - 24);
      const endIdx = Math.min(times.length - 1, curIdx + 24);

      const hourly = [];
      const pastInValues: number[] = [];
      const pastUsValues: number[] = [];

      for (let i = startIdx; i <= endIdx; i++) {
        const tStr = String(times[i] ?? '');
        const p25 = toNonNegativeNumber(pm25Arr[i]);
        const p10 = toNonNegativeNumber(pm10Arr[i]);
        const n2 = toNonNegativeNumber(no2Arr[i]);
        const oz = toNonNegativeNumber(o3Arr[i]);
        const coVal = toNonNegativeNumber(coArr[i]);
        const usVal = toNonNegativeNumber(usAqiArr[i]);
        const inVal = computeIndianNaqi({
          pm25: p25,
          pm10: p10,
          no2: n2,
          o3: oz,
          co: coVal,
          so2: null,
        }).value;

        const isForecast = i > curIdx;
        if (!isForecast && i < curIdx) {
          if (inVal !== null) pastInValues.push(inVal);
          if (usVal !== null) pastUsValues.push(usVal);
        }

        const hhmm = tStr.includes('T') ? tStr.split('T')[1].slice(0, 5) : tStr;
        hourly.push({
          time: tStr,
          label: hhmm,
          pm25: p25,
          pm10: p10,
          no2: n2,
          o3: oz,
          usAqi: usVal,
          inAqi: inVal,
          temperature: toFiniteNumber(tempArr[i]),
          humidity: toFiniteNumber(humArr[i]),
          windSpeed: toFiniteNumber(windArr[i]),
          isForecast,
        });
      }

      const avg = (arr: number[]) =>
        arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;

      const weatherCode = toFiniteNumber(wCur.weather_code);
      const stationCoverage: 'verified' | 'gridded-model' = stationName
        ? 'verified'
        : 'gridded-model';
      const stationNotice = stationName
        ? undefined
        : 'No nearby verified air-quality monitoring station is currently available.';

      const payload = {
        locationName,
        countryCode,
        latitude: lat,
        longitude: lon,
        measuredAt,
        fetchedAt: new Date(nowFn()).toISOString(),
        source: sourceLabel,
        stationName,
        stationCoverage,
        stationNotice,
        pollutants,
        weather: {
          temperature: toFiniteNumber(wCur.temperature_2m),
          humidity: toFiniteNumber(wCur.relative_humidity_2m),
          windSpeed: toFiniteNumber(wCur.wind_speed_10m),
          windDirection: toFiniteNumber(wCur.wind_direction_10m),
          weatherCode,
          weatherLabel: weatherCodeToLabel(weatherCode),
          isDay: wCur.is_day === 1 ? true : wCur.is_day === 0 ? false : null,
        },
        scales: {
          IN_NAQI: inNaqi,
          US_EPA: {
            value: usAqiValue !== null ? Math.round(usAqiValue) : null,
            dominantPollutant: usDominant,
          },
        },
        hourly,
        previous24hAvgAqi: {
          IN_NAQI: avg(pastInValues),
          US_EPA: avg(pastUsValues),
        },
      };

      setBoundedCache(aqCache, cacheKey, payload, AQ_CACHE_TTL_MS, nowFn());
      res.json(payload);
    } catch {
      res.status(502).json({
        error: 'Live air quality data is currently unavailable.',
      });
    }
  });

  // Historical Air Quality endpoint
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

      const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)},${days}`;
      const cached = getValidCache(aqHistoryCache, cacheKey, nowFn());
      if (cached) {
        res.json(cached);
        return;
      }

      const histUrl =
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&hourly=pm10,pm2_5,nitrogen_dioxide,ozone,us_aqi` +
        `&past_days=${days}&forecast_days=0&timezone=auto`;

      const raw = (await fetchJsonWithTimeout(histUrl, 12000)) as {
        hourly?: Record<string, unknown[]>;
      };

      const hourly = raw.hourly ?? {};
      const times = Array.isArray(hourly.time) ? (hourly.time as string[]) : [];
      const pm25Arr = Array.isArray(hourly.pm2_5) ? hourly.pm2_5 : [];
      const pm10Arr = Array.isArray(hourly.pm10) ? hourly.pm10 : [];
      const no2Arr = Array.isArray(hourly.nitrogen_dioxide) ? hourly.nitrogen_dioxide : [];
      const o3Arr = Array.isArray(hourly.ozone) ? hourly.ozone : [];
      const usAqiArr = Array.isArray(hourly.us_aqi) ? hourly.us_aqi : [];

      interface Bucket {
        pm25: number[];
        pm10: number[];
        no2: number[];
        o3: number[];
        usAqi: number[];
      }
      const byDate = new Map<string, Bucket>();

      for (let i = 0; i < times.length; i++) {
        const t = String(times[i] ?? '');
        const dateKey = t.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;

        let bucket = byDate.get(dateKey);
        if (!bucket) {
          bucket = { pm25: [], pm10: [], no2: [], o3: [], usAqi: [] };
          byDate.set(dateKey, bucket);
        }

        const p25 = toNonNegativeNumber(pm25Arr[i]);
        const p10 = toNonNegativeNumber(pm10Arr[i]);
        const n2 = toNonNegativeNumber(no2Arr[i]);
        const oz = toNonNegativeNumber(o3Arr[i]);
        const uAqi = toNonNegativeNumber(usAqiArr[i]);

        if (p25 !== null) bucket.pm25.push(p25);
        if (p10 !== null) bucket.pm10.push(p10);
        if (n2 !== null) bucket.no2.push(n2);
        if (oz !== null) bucket.o3.push(oz);
        if (uAqi !== null) bucket.usAqi.push(uAqi);
      }

      const avg = (arr: number[]) =>
        arr.length > 0 ? Number((arr.reduce((s, n) => s + n, 0) / arr.length).toFixed(1)) : null;
      const peak = (arr: number[]) =>
        arr.length > 0 ? Number(Math.max(...arr).toFixed(1)) : null;

      const sortedDates = Array.from(byDate.keys()).sort().slice(-days);
      const daily = sortedDates.map((date) => {
        const b = byDate.get(date)!;
        const pm25Avg = avg(b.pm25);
        const pm10Avg = avg(b.pm10);
        const no2Avg = avg(b.no2);
        const o3Avg = avg(b.o3);
        const usAqiAvg =
          b.usAqi.length > 0
            ? Math.round(b.usAqi.reduce((s, n) => s + n, 0) / b.usAqi.length)
            : null;
        const inAqiAvg = computeIndianNaqi({
          pm25: pm25Avg,
          pm10: pm10Avg,
          no2: no2Avg,
          o3: o3Avg,
          co: null,
          so2: null,
        }).value;

        const [, mm, dd] = date.split('-');
        return {
          date,
          label: `${dd}/${mm}`,
          pm25Avg,
          pm25Peak: peak(b.pm25),
          pm10Avg,
          pm10Peak: peak(b.pm10),
          o3Avg,
          o3Peak: peak(b.o3),
          no2Avg,
          no2Peak: peak(b.no2),
          inAqiAvg,
          usAqiAvg,
        };
      });

      const payload = {
        locationName,
        days,
        source: 'Open-Meteo Copernicus CAMS Historical Archive',
        fetchedAt: new Date(nowFn()).toISOString(),
        daily,
      };

      setBoundedCache(aqHistoryCache, cacheKey, payload, AQ_HISTORY_CACHE_TTL_MS, nowFn());
      res.json(payload);
    } catch {
      res.status(502).json({
        error: 'Historical air quality data is currently unavailable.',
      });
    }
  });

  const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
  const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

  function mapGeminiErrorResponse(error: unknown): { status: number; message: string } {
    if (error instanceof RequestTimeoutError) {
      return {
        status: 504,
        message: 'AI request timed out. Please try again.',
      };
    }
    const raw = error instanceof Error ? error.message : String(error ?? 'Unknown AI error');
    const lower = raw.toLowerCase();
    if (
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('api_key') ||
      lower.includes('invalid key') ||
      lower.includes('permission_denied') ||
      lower.includes('unauthorized')
    ) {
      return {
        status: 503,
        message: 'AI service authentication failed. Please verify the server Gemini configuration.',
      };
    }
    if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
      return {
        status: 429,
        message: 'AI request limit reached temporarily. Please wait a moment and try again.',
      };
    }
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
      return {
        status: 504,
        message: 'AI request timed out. Please try again.',
      };
    }
    if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('overloaded')
    ) {
      return {
        status: 503,
        message: 'AI service is temporarily experiencing high demand. Please retry in a few seconds.',
      };
    }
    return {
      status: 502,
      message: 'AI connection unavailable. Please check your API configuration or try again.',
    };
  }

  function isRetryableGeminiError(error: unknown): boolean {
    if (error instanceof RequestTimeoutError) return false;
    const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
    if (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('api_key') ||
      msg.includes('permission_denied') ||
      msg.includes('unauthorized')
    ) {
      return false;
    }
    return (
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('unavailable') ||
      msg.includes('resource_exhausted') ||
      msg.includes('high demand') ||
      msg.includes('overloaded') ||
      msg.includes('timeout') ||
      msg.includes('fetch failed')
    );
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function generateGeminiWithFallback(
    ai: GeminiClientLike,
    params: {
      contents: unknown;
      config?: Record<string, unknown>;
    },
    deadlineMs: number
  ) {
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: PRIMARY_GEMINI_MODEL, delayMs: 0 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 250 },
      { model: PRIMARY_GEMINI_MODEL, delayMs: 700 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 1200 },
    ];

    let lastErr: unknown;
    for (const attempt of attempts) {
      const remaining = deadlineMs - nowFn();
      if (remaining <= 50) {
        throw new RequestTimeoutError('AI request timed out.');
      }
      if (attempt.delayMs > 0) {
        await sleep(Math.min(attempt.delayMs, Math.max(10, remaining - 50)));
      }
      const callRemaining = deadlineMs - nowFn();
      if (callRemaining <= 50) {
        throw new RequestTimeoutError('AI request timed out.');
      }
      try {
        return await withTimeout(
          ai.models.generateContent({
            model: attempt.model,
            contents: params.contents,
            config: params.config,
          }),
          callRemaining,
          'AI request timed out.'
        );
      } catch (err) {
        lastErr = err;
        if (!isRetryableGeminiError(err)) {
          throw err;
        }
      }
    }
    throw lastErr;
  }

  async function* streamGeminiWithFallback(
    ai: GeminiClientLike,
    params: {
      contents: unknown;
      config?: Record<string, unknown>;
    },
    deadlineMs: number
  ): AsyncGenerator<string> {
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: PRIMARY_GEMINI_MODEL, delayMs: 0 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 250 },
      { model: PRIMARY_GEMINI_MODEL, delayMs: 700 },
    ];
    let lastErr: unknown;

    for (const attempt of attempts) {
      const remaining = deadlineMs - nowFn();
      if (remaining <= 50) {
        throw new RequestTimeoutError('AI request timed out.');
      }
      if (attempt.delayMs > 0) {
        await sleep(Math.min(attempt.delayMs, Math.max(10, remaining - 50)));
      }
      const streamRemaining = deadlineMs - nowFn();
      if (streamRemaining <= 50) {
        throw new RequestTimeoutError('AI request timed out.');
      }
      let emittedAny = false;
      try {
        const stream = await withTimeout(
          ai.models.generateContentStream({
            model: attempt.model,
            contents: params.contents,
            config: params.config,
          }),
          streamRemaining,
          'AI request timed out.'
        );
        for await (const chunk of stream) {
          if (nowFn() > deadlineMs) {
            throw new RequestTimeoutError('AI request timed out.');
          }
          const text = chunk.text;
          if (text) {
            emittedAny = true;
            yield text;
          }
        }
        return;
      } catch (err) {
        lastErr = err;
        if (emittedAny || !isRetryableGeminiError(err)) {
          throw err;
        }
      }
    }
    throw lastErr;
  }

  async function lookupCityWeatherAndAirQuality(locationQuery: string) {
    const q = sanitizePromptText(locationQuery, 100);
    if (!q) {
      return { error: 'Location query was empty.' };
    }

    let lat: number | null = null;
    let lon: number | null = null;
    let resolvedName = q;
    let country = '';
    let countryCode = '';

    const isPostal = /^\d{4,7}$/.test(q);
    if (isPostal) {
      const countryHint = q.length === 6 ? '&countrycodes=in' : '';
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&postalcode=${encodeURIComponent(
        q
      )}${countryHint}&addressdetails=1&limit=1`;
      const nomData = (await fetchJsonWithTimeout(nomUrl, 8000)) as Array<{
        lat: string;
        lon: string;
        address?: Record<string, string>;
      }>;
      if (Array.isArray(nomData) && nomData.length > 0) {
        const item = nomData[0];
        const addr = item.address ?? {};
        const parsedLat = Number(item.lat);
        const parsedLon = Number(item.lon);
        if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon)) {
          lat = parsedLat;
          lon = parsedLon;
          const city = addr.city || addr.town || addr.suburb || addr.state_district || q;
          const region = addr.state || '';
          country = addr.country || '';
          countryCode = (addr.country_code || '').toUpperCase();
          resolvedName = region ? `${city}, ${region} (${q})` : `${city} (${q})`;
        }
      }
    }

    if (lat === null || lon === null) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=1&language=en&format=json`;
      const geoData = (await fetchJsonWithTimeout(geoUrl, 8000)) as {
        results?: Array<{
          name: string;
          admin1?: string;
          country?: string;
          country_code?: string;
          latitude: number;
          longitude: number;
        }>;
      };
      const match = geoData.results?.[0];
      if (!match) {
        return { error: `No location match found for "${q}".` };
      }
      lat = match.latitude;
      lon = match.longitude;
      resolvedName = match.admin1 ? `${match.name}, ${match.admin1}` : match.name;
      country = match.country || '';
      countryCode = (match.country_code || '').toUpperCase();
    }

    const aqUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi` +
      `&timezone=auto`;

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
      `&longitude=${encodeURIComponent(lon)}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,uv_index,weather_code,is_day` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&forecast_days=3&timezone=auto`;

    const [aqRaw, wRaw] = await Promise.all([
      fetchJsonWithTimeout(aqUrl, 9000) as Promise<{ current?: Record<string, unknown> }>,
      fetchJsonWithTimeout(weatherUrl, 9000) as Promise<{
        current?: Record<string, unknown>;
        daily?: Record<string, unknown[]>;
      }>,
    ]);

    const aqCur = aqRaw.current ?? {};
    const wCur = wRaw.current ?? {};
    const wDaily = wRaw.daily ?? {};

    const pollutants = {
      pm25: toNonNegativeNumber(aqCur.pm2_5),
      pm10: toNonNegativeNumber(aqCur.pm10),
      no2: toNonNegativeNumber(aqCur.nitrogen_dioxide),
      o3: toNonNegativeNumber(aqCur.ozone),
      co: toNonNegativeNumber(aqCur.carbon_monoxide),
      so2: toNonNegativeNumber(aqCur.sulphur_dioxide),
    };
    const inNaqi = computeIndianNaqi(pollutants);
    const weatherCode = toFiniteNumber(wCur.weather_code);

    const dailyDates = Array.isArray(wDaily.time) ? wDaily.time : [];
    const dailyMax = Array.isArray(wDaily.temperature_2m_max) ? wDaily.temperature_2m_max : [];
    const dailyMin = Array.isArray(wDaily.temperature_2m_min) ? wDaily.temperature_2m_min : [];
    const dailyPrecip = Array.isArray(wDaily.precipitation_probability_max)
      ? wDaily.precipitation_probability_max
      : [];
    const dailyCodes = Array.isArray(wDaily.weather_code) ? wDaily.weather_code : [];

    const forecast3Days = dailyDates.slice(0, 3).map((d, idx) => ({
      date: String(d),
      condition: weatherCodeToLabel(toFiniteNumber(dailyCodes[idx])),
      minTempC: toFiniteNumber(dailyMin[idx]),
      maxTempC: toFiniteNumber(dailyMax[idx]),
      rainChancePct: toFiniteNumber(dailyPrecip[idx]),
    }));

    return {
      location: resolvedName,
      country,
      countryCode,
      measuredAt: typeof aqCur.time === 'string' ? aqCur.time : new Date(nowFn()).toISOString(),
      source: 'Open-Meteo Copernicus CAMS & Weather Forecast',
      airQuality: {
        usEpaAqi: toNonNegativeNumber(aqCur.us_aqi),
        indianNaqi: inNaqi.value,
        dominantPollutant: inNaqi.dominantPollutant,
        pm25UgM3: pollutants.pm25,
        pm10UgM3: pollutants.pm10,
        no2UgM3: pollutants.no2,
        o3UgM3: pollutants.o3,
        coUgM3: pollutants.co,
      },
      weather: {
        condition: weatherCodeToLabel(weatherCode),
        temperatureC: toFiniteNumber(wCur.temperature_2m),
        feelsLikeC: toFiniteNumber(wCur.apparent_temperature),
        humidityPct: toNonNegativeNumber(wCur.relative_humidity_2m),
        precipitationMm: toNonNegativeNumber(wCur.precipitation),
        windSpeedKmh: toNonNegativeNumber(wCur.wind_speed_10m),
        windDirectionDeg: toFiniteNumber(wCur.wind_direction_10m),
        uvIndex: toNonNegativeNumber(wCur.uv_index),
        isDay: wCur.is_day === 1,
      },
      forecast3Days,
    };
  }

  const lookupWeatherAndAqiDeclaration = {
    name: 'lookup_city_weather_and_air_quality',
    description:
      'Fetches live weather conditions (temperature, feels-like, humidity, wind, precipitation, UV index, 3-day forecast) and live air quality (US EPA AQI, Indian NAQI, PM2.5, PM10, NO2, O3, CO) for any city, region, or postal/PIN code.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        locationQuery: {
          type: Type.STRING,
          description:
            'City name, neighborhood/region, or postal/PIN code (e.g., "Mumbai", "New Delhi", "110001", "London").',
        },
      },
      required: ['locationQuery'],
    },
  };

  // Gemini AI Daily Routine Generator
  app.post('/api/gemini/routine', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid routine request payload.' });
        return;
      }

      const { profile, airQuality, activeScale, language } = body as {
        profile?: Record<string, unknown>;
        airQuality?: Record<string, unknown>;
        activeScale?: string;
        language?: string;
      };

      const safeLang = language === 'hi' ? 'hi' : 'en';
      const safeScale = activeScale === 'US_EPA' ? 'US_EPA' : 'IN_NAQI';
      const langInstruction =
        safeLang === 'hi'
          ? 'Write all human-readable fields (aqiSummary, safetyNote, whatToDo, whyItMatters, howToDoIt, estimatedImpact, cost, whoBenefits) in natural, clear Hindi (Devanagari script). Keep ONLY the enum fields timeBlock ("morning"|"afternoon"|"evening"|"night") and difficulty ("Easy"|"Moderate"|"Challenging") in English.'
          : 'Write all fields in clear, practical English.';

      const pLoc = (profile?.location as Record<string, unknown> | undefined) ?? undefined;
      const pHouse = (profile?.household as Record<string, unknown> | undefined) ?? undefined;
      const pPref = (profile?.preferences as Record<string, unknown> | undefined) ?? undefined;

      const locationName =
        sanitizePromptText(pLoc?.name, 120) ||
        sanitizePromptText(airQuality?.locationName, 120) ||
        'Unknown location';
      const countryName = sanitizePromptText(pLoc?.country, 60);
      const lifestyle = sanitizePromptText(profile?.lifestyle, 40) || 'general';
      const familyMembers = Math.max(
        1,
        Math.min(30, Math.round(toFiniteNumber(pHouse?.familyMembers) ?? 1))
      );
      const outdoorActivity = sanitizePromptText(pHouse?.typicalOutdoorActivity, 30) || 'moderate';
      const commuteMode = sanitizePromptText(pPref?.commuteMode, 30) || 'mixed';
      const diet = sanitizePromptText(pPref?.diet, 30) || 'flexible';
      const budget = sanitizePromptText(pPref?.budget, 30) || 'moderate';

      const aqScales = (airQuality?.scales as Record<string, Record<string, unknown>> | undefined) ?? {};
      const aqPollutants = (airQuality?.pollutants as Record<string, unknown> | undefined) ?? {};
      const aqWeather = (airQuality?.weather as Record<string, unknown> | undefined) ?? {};

      const scaleLabel =
        safeScale === 'IN_NAQI' ? 'Indian National AQI (CPCB)' : 'US EPA AQI';
      const aqiVal =
        safeScale === 'IN_NAQI'
          ? toFiniteNumber(aqScales.IN_NAQI?.value)
          : toFiniteNumber(aqScales.US_EPA?.value);

      const contextText = `
User Context:
- Location: ${locationName} (${countryName})
- Lifestyle: ${lifestyle}
- Household: ${familyMembers} members, children: ${
        pHouse?.hasChildren ? 'yes' : 'no'
      }, elderly: ${pHouse?.hasElderly ? 'yes' : 'no'}, pets: ${
        pHouse?.hasPets ? 'yes' : 'no'
      }, outdoor activity: ${outdoorActivity}
- Preferences: commute=${commuteMode}, diet=${diet}, budget=${budget}

Air Quality & Weather Context:
- Active Scale: ${scaleLabel}
- Current AQI: ${aqiVal !== null ? aqiVal : 'Unavailable'}
- PM2.5: ${toFiniteNumber(aqPollutants.pm25) ?? 'N/A'} µg/m³, PM10: ${
        toFiniteNumber(aqPollutants.pm10) ?? 'N/A'
      } µg/m³, NO2: ${toFiniteNumber(aqPollutants.no2) ?? 'N/A'} µg/m³, O3: ${
        toFiniteNumber(aqPollutants.o3) ?? 'N/A'
      } µg/m³
- Temperature: ${toFiniteNumber(aqWeather.temperature) ?? 'N/A'} °C, Humidity: ${
        toFiniteNumber(aqWeather.humidity) ?? 'N/A'
      }%, Wind: ${toFiniteNumber(aqWeather.windSpeed) ?? 'N/A'} km/h
`;

      const deadlineMs = nowFn() + geminiTimeoutMs;
      const response = await generateGeminiWithFallback(
        ai,
        {
          contents: `Generate a practical, location-aware daily clean-air routine for today based on the context below. Provide 2 actionable recommendations per time block (morning, afternoon, evening, night — 8 recommendations total).
${contextText}
Requirements:
- Morning must cover outdoor exercise/commute/school or ventilation timing tailored to actual AQI.
- Afternoon must cover indoor activity, safe ventilation windows (only if AQI permits; otherwise explain why to keep closed), and low-emission meal/shopping choices respecting diet & budget.
- Evening must cover exercise alternatives, cooking exhaust/ventilation guidance, and exposure reduction.
- Night must cover bedroom air-quality practices, dust reduction, and indoor combustion prevention.
- Be realistic and grounded. Never promise that any routine completely eliminates exposure or prevents disease.
- Language Requirement: ${langInstruction}`,
          config: {
            systemInstruction:
              'You are HAWA JANO, an environmental health and clean-air planner. Return strictly valid JSON matching the schema. Keep advice practical, empathetic, specific to household composition and budget, and medically responsible.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                aqiSummary: {
                  type: Type.STRING,
                  description: 'One-sentence summary of today’s air conditions for this household.',
                },
                safetyNote: {
                  type: Type.STRING,
                  description:
                    'Clear reminder that routines reduce exposure risk where possible and do not eliminate exposure or replace medical advice.',
                },
                recommendations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      timeBlock: {
                        type: Type.STRING,
                        description: 'Must be one of: morning, afternoon, evening, night',
                      },
                      whatToDo: { type: Type.STRING },
                      whyItMatters: { type: Type.STRING },
                      howToDoIt: { type: Type.STRING },
                      estimatedImpact: { type: Type.STRING },
                      cost: { type: Type.STRING },
                      difficulty: {
                        type: Type.STRING,
                        description: 'Must be one of: Easy, Moderate, Challenging',
                      },
                      whoBenefits: { type: Type.STRING },
                    },
                    required: [
                      'id',
                      'timeBlock',
                      'whatToDo',
                      'whyItMatters',
                      'howToDoIt',
                      'estimatedImpact',
                      'cost',
                      'difficulty',
                      'whoBenefits',
                    ],
                  },
                },
              },
              required: ['aqiSummary', 'safetyNote', 'recommendations'],
            },
          },
        },
        deadlineMs
      );

      const cleanedText = stripMarkdownJsonFences(response.text ?? '');
      if (!cleanedText) {
        res.status(502).json({ error: 'AI returned an empty routine response. Please try again.' });
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        const decoded = JSON.parse(cleanedText);
        if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
          throw new Error('Invalid object');
        }
        parsed = decoded as Record<string, unknown>;
      } catch {
        res.status(502).json({
          error: 'AI returned an unexpected routine format. Please try generating again.',
        });
        return;
      }

      const validBlocks = new Set(['morning', 'afternoon', 'evening', 'night']);
      const validDiffs = new Set(['Easy', 'Moderate', 'Challenging']);
      const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

      const recommendations = rawRecs
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
        .map((r, idx) => ({
          id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `rec-${idx + 1}`,
          timeBlock: validBlocks.has(String(r.timeBlock))
            ? (String(r.timeBlock) as 'morning' | 'afternoon' | 'evening' | 'night')
            : 'morning',
          whatToDo: typeof r.whatToDo === 'string' ? r.whatToDo : '',
          whyItMatters: typeof r.whyItMatters === 'string' ? r.whyItMatters : '',
          howToDoIt: typeof r.howToDoIt === 'string' ? r.howToDoIt : '',
          estimatedImpact: typeof r.estimatedImpact === 'string' ? r.estimatedImpact : '',
          cost: typeof r.cost === 'string' ? r.cost : '',
          difficulty: validDiffs.has(String(r.difficulty))
            ? (String(r.difficulty) as 'Easy' | 'Moderate' | 'Challenging')
            : 'Easy',
          whoBenefits: typeof r.whoBenefits === 'string' ? r.whoBenefits : '',
        }))
        .filter((r) => r.whatToDo.trim().length > 0);

      if (recommendations.length === 0) {
        res.status(502).json({
          error: 'AI did not return valid routine steps. Please try generating again.',
        });
        return;
      }

      res.json({
        generatedAt: new Date(nowFn()).toISOString(),
        locationName,
        aqiSummary:
          typeof parsed.aqiSummary === 'string' && parsed.aqiSummary.trim()
            ? parsed.aqiSummary.trim()
            : 'Personalized clean-air routine generated.',
        safetyNote:
          typeof parsed.safetyNote === 'string' && parsed.safetyNote.trim()
            ? parsed.safetyNote.trim()
            : 'These steps help reduce daily pollution exposure where practical. They do not eliminate exposure or prevent disease.',
        recommendations,
      });
    } catch (error) {
      const mapped = mapGeminiErrorResponse(error);
      res.status(mapped.status).json({ error: `Could not generate AI routine: ${mapped.message}` });
    }
  });

  // Gemini AI Conversational Assistant
  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid chat request payload.' });
        return;
      }

      const { messages, profile, airQuality, activeScale, language } = body as {
        messages?: unknown;
        profile?: Record<string, unknown>;
        airQuality?: Record<string, unknown>;
        activeScale?: string;
        language?: string;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Conversation message is required.' });
        return;
      }

      const safeLang = language === 'hi' ? 'hi' : 'en';
      const safeScale = activeScale === 'US_EPA' ? 'US_EPA' : 'IN_NAQI';
      const scaleLabel =
        safeScale === 'IN_NAQI' ? 'Indian National AQI (CPCB)' : 'US EPA AQI';

      const pLoc = (profile?.location as Record<string, unknown> | undefined) ?? undefined;
      const pHouse = (profile?.household as Record<string, unknown> | undefined) ?? undefined;
      const pPref = (profile?.preferences as Record<string, unknown> | undefined) ?? undefined;

      const aqScales = (airQuality?.scales as Record<string, Record<string, unknown>> | undefined) ?? {};
      const aqPollutants = (airQuality?.pollutants as Record<string, unknown> | undefined) ?? {};
      const aqWeather = (airQuality?.weather as Record<string, unknown> | undefined) ?? {};

      const activeScaleObj = safeScale === 'IN_NAQI' ? aqScales.IN_NAQI : aqScales.US_EPA;
      const aqiVal = toFiniteNumber(activeScaleObj?.value);
      const dominantPollutant = sanitizePromptText(activeScaleObj?.dominantPollutant, 20) || 'N/A';

      const safeLocName = sanitizePromptText(pLoc?.name, 120) || 'Not yet selected';
      const safeCountry = sanitizePromptText(pLoc?.country, 60);
      const safeLifestyle = sanitizePromptText(profile?.lifestyle, 40) || 'General';
      const safeMembers = Math.max(
        1,
        Math.min(30, Math.round(toFiniteNumber(pHouse?.familyMembers) ?? 1))
      );

      const systemInstruction = `You are HAWA JANO, a warm, empathetic, knowledgeable, calm, and practical weather, air quality, and environmental health companion.
Domain Scope: You answer questions about:
- Weather conditions, temperature, humidity, wind dispersion, fog/temperature inversions, rain washout, UV, and multi-day weather outlook.
- Air pollution, AQI (Indian NAQI & US EPA), PM2.5, PM10, NO2, O3, CO, winter smog, wildfire smoke, dust storms, and pollution sources.
- Everyday protection: outdoor walks/workouts, children & school commutes, elderly & respiratory safety, N95/FFP2 masks, window ventilation timing, HEPA purifiers & CADR, indoor cooking/incense emissions, and sustainable eco-friendly swaps.
- Multi-city weather & AQI lookups/comparisons: Whenever the user asks about weather or air quality in ANY specific city, town, or PIN code (or asks even about their own active location if weather forecast/UV/precipitation is missing from the snapshot below), call the \`lookup_city_weather_and_air_quality\` tool first to fetch live data instead of guessing.

Languages: You naturally understand and reply in English, Hindi (Devanagari or Romanized), or Hinglish.
Active Interface Language: ${safeLang === 'hi' ? 'Hindi (हिन्दी)' : 'English'}. Match the user's message language naturally; if the active UI language is Hindi and the user writes in Hindi or asks generally, respond in clear, empathetic Hindi (Devanagari).

Current User & Active Location Context:
- Location: ${safeLocName} (${safeCountry})
- AQI Scale: ${scaleLabel}
- Latest AQI: ${aqiVal !== null ? `${aqiVal} (Dominant: ${dominantPollutant})` : 'Live air quality data is currently unavailable'}
- Pollutants: PM2.5=${toFiniteNumber(aqPollutants.pm25) ?? 'N/A'} µg/m³, PM10=${
        toFiniteNumber(aqPollutants.pm10) ?? 'N/A'
      } µg/m³, NO2=${toFiniteNumber(aqPollutants.no2) ?? 'N/A'} µg/m³, O3=${
        toFiniteNumber(aqPollutants.o3) ?? 'N/A'
      } µg/m³, CO=${toFiniteNumber(aqPollutants.co) ?? 'N/A'} µg/m³
- Weather: Temp=${toFiniteNumber(aqWeather.temperature) ?? 'N/A'} °C, Humidity=${
        toFiniteNumber(aqWeather.humidity) ?? 'N/A'
      }%, Wind=${toFiniteNumber(aqWeather.windSpeed) ?? 'N/A'} km/h (${
        sanitizePromptText(aqWeather.weatherLabel, 40) || 'N/A'
      })
- Lifestyle: ${safeLifestyle}
- Household: ${safeMembers} people, children=${
        pHouse?.hasChildren ? 'yes' : 'no'
      }, elderly=${pHouse?.hasElderly ? 'yes' : 'no'}, pets=${
        pHouse?.hasPets ? 'yes' : 'no'
      }
- Preferences: commute=${sanitizePromptText(pPref?.commuteMode, 30) || 'N/A'}, diet=${
        sanitizePromptText(pPref?.diet, 30) || 'N/A'
      }, budget=${sanitizePromptText(pPref?.budget, 30) || 'N/A'}

Mandatory Safety & Grounding Rules:
1. Reference real location, weather, and pollutant readings from either the active context above or the \`lookup_city_weather_and_air_quality\` tool. If live data cannot be fetched, state that transparently rather than fabricating numbers.
2. NEVER diagnose medical conditions or replace professional medical advice.
3. For severe or hazardous pollution: recommend following local public-health guidance, explain practical exposure-reduction steps, and advise seeking urgent medical attention for serious breathing difficulty, chest pain, wheezing, or emergency symptoms.
4. NEVER provide false reassurance about hazardous air quality or claim an action eliminates all exposure.
5. Format clearly using short headings/bold labels and scannable bullet points.`;

      const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = messages
        .filter(
          (m: unknown): m is { role?: string; content: string } =>
            Boolean(m) &&
            typeof m === 'object' &&
            typeof (m as { content?: unknown }).content === 'string' &&
            (m as { content: string }).content.trim().length > 0
        )
        .slice(-14)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content.trim().slice(0, 4000) }],
        }));

      if (contents.length === 0) {
        res.status(400).json({ error: 'Conversation message cannot be empty.' });
        return;
      }

      const deadlineMs = nowFn() + geminiTimeoutMs;
      const toolConfig = {
        systemInstruction,
        tools: [{ functionDeclarations: [lookupWeatherAndAqiDeclaration] }],
      };

      let finalDirectText: string | null = null;
      for (let round = 0; round < 2; round++) {
        const turnResp = await generateGeminiWithFallback(
          ai,
          {
            contents,
            config: toolConfig,
          },
          deadlineMs
        );

        const calls = turnResp.functionCalls ?? [];
        if (calls.length === 0) {
          finalDirectText = turnResp.text ?? '';
          break;
        }

        const modelContent = turnResp.candidates?.[0]?.content;
        if (modelContent) {
          contents.push(modelContent as { role: string; parts: Array<Record<string, unknown>> });
        }

        const fnParts = await Promise.all(
          calls.map(async (call) => {
            if (call.name === 'lookup_city_weather_and_air_quality') {
              const locArg =
                typeof call.args?.locationQuery === 'string'
                  ? call.args.locationQuery
                  : safeLocName !== 'Not yet selected'
                    ? safeLocName
                    : '';
              let resultData: Record<string, unknown>;
              try {
                resultData = (await lookupCityWeatherAndAirQuality(locArg)) as Record<
                  string,
                  unknown
                >;
              } catch {
                resultData = {
                  error: 'Weather & AQI lookup failed temporarily.',
                };
              }
              return {
                functionResponse: {
                  name: call.name,
                  id: call.id,
                  response: { result: resultData },
                },
              };
            }
            return {
              functionResponse: {
                name: call.name ?? 'unknown',
                id: call.id,
                response: { error: 'Unsupported tool requested.' },
              },
            };
          })
        );

        contents.push({
          role: 'user',
          parts: fnParts,
        });
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');

      if (finalDirectText && finalDirectText.trim().length > 0) {
        const chunkSize = 48;
        for (let i = 0; i < finalDirectText.length; i += chunkSize) {
          res.write(
            `data: ${JSON.stringify({ text: finalDirectText.slice(i, i + chunkSize) })}\n\n`
          );
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }

      let emittedStreamText = false;
      for await (const text of streamGeminiWithFallback(
        ai,
        {
          contents,
          config: { systemInstruction },
        },
        deadlineMs
      )) {
        emittedStreamText = true;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      if (!emittedStreamText) {
        res.write(
          `data: ${JSON.stringify({
            error: 'AI connection unavailable. Please check your API configuration or try again.',
          })}\n\n`
        );
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      const mapped = mapGeminiErrorResponse(error);
      if (!res.headersSent) {
        res.status(mapped.status).json({ error: mapped.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: mapped.message })}\n\n`);
        res.end();
      }
    }
  });

  return app;
}
