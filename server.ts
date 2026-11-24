import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Initialize Gemini SDK strictly on the server
function getGeminiClient(): GoogleGenAI | null {
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
  });
}

// Simple in-memory TTL cache for air quality responses (prevents upstream rate limits)
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const aqCache = new Map<string, CacheEntry<unknown>>();
const AQ_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const aqHistoryCache = new Map<string, CacheEntry<unknown>>();
const AQ_HISTORY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Breakpoint helper for server-side Indian National AQI computation
interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

const IN_PM25_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 30.01, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 60.01, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 90.01, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 120.01, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 250.01, cHigh: 500, iLow: 401, iHigh: 500 },
];

const IN_PM10_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50.01, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100.01, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 250.01, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 350.01, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 430.01, cHigh: 600, iLow: 401, iHigh: 500 },
];

const IN_NO2_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40.01, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80.01, cHigh: 180, iLow: 101, iHigh: 200 },
  { cLow: 180.01, cHigh: 280, iLow: 201, iHigh: 300 },
  { cLow: 280.01, cHigh: 400, iLow: 301, iHigh: 400 },
  { cLow: 400.01, cHigh: 600, iLow: 401, iHigh: 500 },
];

const IN_O3_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50.01, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100.01, cHigh: 168, iLow: 101, iHigh: 200 },
  { cLow: 168.01, cHigh: 208, iLow: 201, iHigh: 300 },
  { cLow: 208.01, cHigh: 748, iLow: 301, iHigh: 400 },
  { cLow: 748.01, cHigh: 1000, iLow: 401, iHigh: 500 },
];

const IN_CO_MG_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 1.0, iLow: 0, iHigh: 50 },
  { cLow: 1.01, cHigh: 2.0, iLow: 51, iHigh: 100 },
  { cLow: 2.01, cHigh: 10.0, iLow: 101, iHigh: 200 },
  { cLow: 10.01, cHigh: 17.0, iLow: 201, iHigh: 300 },
  { cLow: 17.01, cHigh: 34.0, iLow: 301, iHigh: 400 },
  { cLow: 34.01, cHigh: 50.0, iLow: 401, iHigh: 500 },
];

const IN_SO2_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40.01, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80.01, cHigh: 380, iLow: 101, iHigh: 200 },
  { cLow: 380.01, cHigh: 800, iLow: 201, iHigh: 300 },
  { cLow: 800.01, cHigh: 1600, iLow: 301, iHigh: 400 },
  { cLow: 1600.01, cHigh: 2500, iLow: 401, iHigh: 500 },
];

function calcSubIndex(concentration: number | null, bps: Breakpoint[]): number | null {
  if (concentration === null || Number.isNaN(concentration) || concentration < 0) return null;
  for (const bp of bps) {
    if (concentration <= bp.cHigh) {
      const ratio = (concentration - bp.cLow) / (bp.cHigh - bp.cLow);
      return Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));
    }
  }
  const last = bps[bps.length - 1];
  return Math.min(999, Math.round(last.iHigh + (concentration - last.cHigh) * 0.4));
}

function computeInNaqi(p: {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
}): { value: number | null; dominantPollutant: string | null } {
  const candidates = [
    { name: 'PM2.5', sub: calcSubIndex(p.pm25, IN_PM25_BP) },
    { name: 'PM10', sub: calcSubIndex(p.pm10, IN_PM10_BP) },
    { name: 'NO2', sub: calcSubIndex(p.no2, IN_NO2_BP) },
    { name: 'O3', sub: calcSubIndex(p.o3, IN_O3_BP) },
    { name: 'CO', sub: calcSubIndex(p.co !== null ? p.co / 1000 : null, IN_CO_MG_BP) },
    { name: 'SO2', sub: calcSubIndex(p.so2, IN_SO2_BP) },
  ].filter((c): c is { name: string; sub: number } => c.sub !== null);

  if (candidates.length === 0) return { value: null, dominantPollutant: null };
  candidates.sort((a, b) => b.sub - a.sub);
  return { value: candidates[0].sub, dominantPollutant: candidates[0].name };
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

function toNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HAWA-JANO/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Upstream HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      geminiConfigured: Boolean(getGeminiClient()),
      waqiConfigured: Boolean(process.env.WAQI_API_KEY?.trim()),
    });
  });

  // Geocode endpoint: supports city names, Indian PIN codes, or reverse geocoding
  app.get('/api/geocode', async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const latStr = typeof req.query.lat === 'string' ? req.query.lat.trim() : '';
      const lonStr = typeof req.query.lon === 'string' ? req.query.lon.trim() : '';

      // Reverse geocoding from coordinates
      if (latStr && lonStr) {
        const lat = Number(latStr);
        const lon = Number(lonStr);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          res.status(400).json({ error: 'Invalid coordinates provided.' });
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
        const region = addr.state || addr.region || '';
        const country = addr.country || 'Unknown';
        const countryCode = (addr.country_code || '').toUpperCase();
        const pinCode = addr.postcode || undefined;

        res.json({
          results: [
            {
              name: region ? `${city}, ${region}` : city,
              city,
              region,
              country,
              countryCode,
              pinCode,
              latitude: lat,
              longitude: lon,
            },
          ],
        });
        return;
      }

      if (!q || q.length < 2) {
        res.status(400).json({ error: 'Enter at least 2 characters for city or PIN code.' });
        return;
      }

      // If query looks like a postal/PIN code (mostly digits, e.g., 110001 or 94107)
      const isPostal = /^\d{4,7}$/.test(q);
      if (isPostal) {
        // Query Nominatim for postal code (prioritize India if 6-digit PIN)
        const countryHint = q.length === 6 ? '&countrycodes=in' : '';
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&postalcode=${encodeURIComponent(
          q
        )}${countryHint}&addressdetails=1&limit=5`;
        const nomData = (await fetchJsonWithTimeout(nomUrl, 8000)) as Array<{
          lat: string;
          lon: string;
          display_name: string;
          address?: Record<string, string>;
        }>;

        let results = (Array.isArray(nomData) ? nomData : []).map((item) => {
          const addr = item.address ?? {};
          const city =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.suburb ||
            addr.state_district ||
            addr.county ||
            q;
          const region = addr.state || '';
          const country = addr.country || (q.length === 6 ? 'India' : '');
          const countryCode = (addr.country_code || (q.length === 6 ? 'IN' : '')).toUpperCase();
          return {
            name: region ? `${city}, ${region} (${q})` : `${city} (${q})`,
            city,
            region,
            country,
            countryCode,
            pinCode: q,
            latitude: Number(item.lat),
            longitude: Number(item.lon),
          };
        });

        // Fallback to general Nominatim search if country-hinted postal returned nothing
        if (results.length === 0) {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
            q
          )}&addressdetails=1&limit=5`;
          const fbData = (await fetchJsonWithTimeout(fallbackUrl, 8000)) as typeof nomData;
          results = (Array.isArray(fbData) ? fbData : []).map((item) => {
            const addr = item.address ?? {};
            const city = addr.city || addr.town || addr.suburb || addr.state_district || q;
            const region = addr.state || '';
            const country = addr.country || '';
            const countryCode = (addr.country_code || '').toUpperCase();
            return {
              name: region ? `${city}, ${region}` : city,
              city,
              region,
              country,
              countryCode,
              pinCode: addr.postcode || q,
              latitude: Number(item.lat),
              longitude: Number(item.lon),
            };
          });
        }

        res.json({ results });
        return;
      }

      // Standard city / region search via Open-Meteo Geocoding API
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=6&language=en&format=json`;
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

      const results = (geoData.results ?? []).map((r) => ({
        name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
        city: r.name,
        region: r.admin1 || '',
        country: r.country || '',
        countryCode: (r.country_code || '').toUpperCase(),
        latitude: r.latitude,
        longitude: r.longitude,
      }));

      res.json({ results });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Location lookup failed';
      res.status(502).json({ error: `Unable to look up location right now (${msg}).` });
    }
  });

  // Live Air Quality + Weather proxy (Open-Meteo CAMS + Weather, optionally enriched with WAQI if configured)
  app.get('/api/air-quality', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      const locationName =
        typeof req.query.name === 'string' && req.query.name.trim()
          ? req.query.name.trim()
          : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      const countryCode =
        typeof req.query.countryCode === 'string' ? req.query.countryCode.trim().toUpperCase() : '';

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        res.status(400).json({ error: 'Valid latitude and longitude are required.' });
        return;
      }

      const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      const cached = aqCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.value);
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

      let pollutants = {
        pm25: toNum(aqCur.pm2_5),
        pm10: toNum(aqCur.pm10),
        no2: toNum(aqCur.nitrogen_dioxide),
        o3: toNum(aqCur.ozone),
        co: toNum(aqCur.carbon_monoxide),
        so2: toNum(aqCur.sulphur_dioxide),
      };

      let usAqiValue = toNum(aqCur.us_aqi);
      let sourceLabel = 'Open-Meteo Copernicus CAMS & Weather';
      let stationName: string | undefined;
      let measuredAt =
        typeof aqCur.time === 'string' ? aqCur.time : new Date().toISOString();

      // Optional WAQI ground-station enrichment if WAQI_API_KEY is configured on server
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
              iaqi?: Record<string, { v?: number }>;
            };
          };
          if (waqiRes.status === 'ok' && waqiRes.data) {
            stationName = waqiRes.data.city?.name;
            if (typeof waqiRes.data.aqi === 'number') {
              usAqiValue = waqiRes.data.aqi;
            }
            if (waqiRes.data.time?.iso) {
              measuredAt = waqiRes.data.time.iso;
            }
            sourceLabel = 'WAQI Monitoring Station + Open-Meteo Forecast';
          }
        } catch {
          // Non-fatal: continue with Open-Meteo CAMS data
        }
      }

      const inNaqi = computeInNaqi(pollutants);
      const usDominant =
        pollutants.pm25 !== null && pollutants.pm10 !== null
          ? pollutants.pm25 >= pollutants.pm10 * 0.45
            ? 'PM2.5'
            : 'PM10'
          : pollutants.pm25 !== null
            ? 'PM2.5'
            : null;

      // Build hourly series (-24h to +24h around current hour)
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
        const p25 = toNum(pm25Arr[i]);
        const p10 = toNum(pm10Arr[i]);
        const n2 = toNum(no2Arr[i]);
        const oz = toNum(o3Arr[i]);
        const coVal = toNum(coArr[i]);
        const usVal = toNum(usAqiArr[i]);
        const inVal = computeInNaqi({
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
          temperature: toNum(tempArr[i]),
          humidity: toNum(humArr[i]),
          windSpeed: toNum(windArr[i]),
          isForecast,
        });
      }

      const avg = (arr: number[]) =>
        arr.length > 0 ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;

      const weatherCode = toNum(wCur.weather_code);

      const payload = {
        locationName,
        countryCode,
        latitude: lat,
        longitude: lon,
        measuredAt,
        fetchedAt: new Date().toISOString(),
        source: sourceLabel,
        stationName,
        pollutants,
        weather: {
          temperature: toNum(wCur.temperature_2m),
          humidity: toNum(wCur.relative_humidity_2m),
          windSpeed: toNum(wCur.wind_speed_10m),
          windDirection: toNum(wCur.wind_direction_10m),
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

      aqCache.set(cacheKey, { value: payload, expiresAt: Date.now() + AQ_CACHE_TTL_MS });
      res.json(payload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Upstream provider unreachable';
      res.status(502).json({
        error: 'Live air quality data is currently unavailable.',
        details: msg,
      });
    }
  });

  // Historical Air Quality endpoint (7-day or 30-day daily aggregated pollutant trends)
  app.get('/api/air-quality/history', async (req: Request, res: Response) => {
    try {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      const daysParam = Number(req.query.days);
      const days: 7 | 30 = daysParam === 30 ? 30 : 7;
      const locationName =
        typeof req.query.name === 'string' && req.query.name.trim()
          ? req.query.name.trim()
          : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        res.status(400).json({ error: 'Valid latitude and longitude are required.' });
        return;
      }

      const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)},${days}`;
      const cached = aqHistoryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.value);
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

        const p25 = toNum(pm25Arr[i]);
        const p10 = toNum(pm10Arr[i]);
        const n2 = toNum(no2Arr[i]);
        const oz = toNum(o3Arr[i]);
        const uAqi = toNum(usAqiArr[i]);

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
        const usAqiAvg = b.usAqi.length > 0 ? Math.round(b.usAqi.reduce((s, n) => s + n, 0) / b.usAqi.length) : null;
        const inAqiAvg = computeInNaqi({
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
        fetchedAt: new Date().toISOString(),
        daily,
      };

      aqHistoryCache.set(cacheKey, {
        value: payload,
        expiresAt: Date.now() + AQ_HISTORY_CACHE_TTL_MS,
      });
      res.json(payload);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Historical data unavailable';
      res.status(502).json({
        error: 'Historical air quality data is currently unavailable.',
        details: msg,
      });
    }
  });

  const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
  const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

  function extractFriendlyGeminiError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? 'Unknown AI error');
    const lower = raw.toLowerCase();
    if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('overloaded')
    ) {
      return 'AI service is temporarily experiencing high demand. Please retry in a few seconds.';
    }
    if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
      return 'AI request limit reached temporarily. Please wait a moment and try again.';
    }
    if (lower.includes('401') || lower.includes('403') || lower.includes('api_key') || lower.includes('permission_denied')) {
      return 'Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.';
    }
    return raw.length > 220 ? `${raw.slice(0, 220)}...` : raw;
  }

  function isRetryableGeminiError(error: unknown): boolean {
    const msg = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
    return (
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('unavailable') ||
      msg.includes('resource_exhausted') ||
      msg.includes('high demand') ||
      msg.includes('overloaded') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('fetch failed')
    );
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function generateGeminiWithFallback(
    ai: GoogleGenAI,
    params: {
      contents: unknown;
      config?: Record<string, unknown>;
    }
  ) {
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: PRIMARY_GEMINI_MODEL, delayMs: 0 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 350 },
      { model: PRIMARY_GEMINI_MODEL, delayMs: 900 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 1500 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 2400 },
    ];

    let lastErr: unknown;
    for (const attempt of attempts) {
      if (attempt.delayMs > 0) {
        await sleep(attempt.delayMs);
      }
      try {
        return await ai.models.generateContent({
          model: attempt.model,
          contents: params.contents as never,
          config: params.config as never,
        });
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
    ai: GoogleGenAI,
    params: {
      contents: unknown;
      config?: Record<string, unknown>;
    }
  ): AsyncGenerator<string> {
    const attempts: Array<{ model: string; delayMs: number }> = [
      { model: PRIMARY_GEMINI_MODEL, delayMs: 0 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 350 },
      { model: PRIMARY_GEMINI_MODEL, delayMs: 900 },
      { model: FALLBACK_GEMINI_MODEL, delayMs: 1600 },
    ];
    let lastErr: unknown;

    for (const attempt of attempts) {
      if (attempt.delayMs > 0) {
        await sleep(attempt.delayMs);
      }
      let emittedAny = false;
      try {
        const stream = await ai.models.generateContentStream({
          model: attempt.model,
          contents: params.contents as never,
          config: params.config as never,
        });
        for await (const chunk of stream) {
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
    const q = locationQuery.trim();
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
        lat = Number(item.lat);
        lon = Number(item.lon);
        const city = addr.city || addr.town || addr.suburb || addr.state_district || q;
        const region = addr.state || '';
        country = addr.country || '';
        countryCode = (addr.country_code || '').toUpperCase();
        resolvedName = region ? `${city}, ${region} (${q})` : `${city} (${q})`;
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
      pm25: toNum(aqCur.pm2_5),
      pm10: toNum(aqCur.pm10),
      no2: toNum(aqCur.nitrogen_dioxide),
      o3: toNum(aqCur.ozone),
      co: toNum(aqCur.carbon_monoxide),
      so2: toNum(aqCur.sulphur_dioxide),
    };
    const inNaqi = computeInNaqi(pollutants);
    const weatherCode = toNum(wCur.weather_code);

    const dailyDates = Array.isArray(wDaily.time) ? wDaily.time : [];
    const dailyMax = Array.isArray(wDaily.temperature_2m_max) ? wDaily.temperature_2m_max : [];
    const dailyMin = Array.isArray(wDaily.temperature_2m_min) ? wDaily.temperature_2m_min : [];
    const dailyPrecip = Array.isArray(wDaily.precipitation_probability_max)
      ? wDaily.precipitation_probability_max
      : [];
    const dailyCodes = Array.isArray(wDaily.weather_code) ? wDaily.weather_code : [];

    const forecast3Days = dailyDates.slice(0, 3).map((d, idx) => ({
      date: String(d),
      condition: weatherCodeToLabel(toNum(dailyCodes[idx])),
      minTempC: toNum(dailyMin[idx]),
      maxTempC: toNum(dailyMax[idx]),
      rainChancePct: toNum(dailyPrecip[idx]),
    }));

    return {
      location: resolvedName,
      country,
      countryCode,
      measuredAt: typeof aqCur.time === 'string' ? aqCur.time : new Date().toISOString(),
      source: 'Open-Meteo Copernicus CAMS & Weather Forecast',
      airQuality: {
        usEpaAqi: toNum(aqCur.us_aqi),
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
        temperatureC: toNum(wCur.temperature_2m),
        feelsLikeC: toNum(wCur.apparent_temperature),
        humidityPct: toNum(wCur.relative_humidity_2m),
        precipitationMm: toNum(wCur.precipitation),
        windSpeedKmh: toNum(wCur.wind_speed_10m),
        windDirectionDeg: toNum(wCur.wind_direction_10m),
        uvIndex: toNum(wCur.uv_index),
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
          description: 'City name, neighborhood/region, or postal/PIN code (e.g., "Mumbai", "New Delhi", "110001", "London").',
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
      const { profile, airQuality, activeScale, language } = req.body ?? {};
      const langInstruction =
        language === 'hi'
          ? 'Write all human-readable fields (aqiSummary, safetyNote, whatToDo, whyItMatters, howToDoIt, estimatedImpact, cost, whoBenefits) in natural, clear Hindi (Devanagari script). Keep ONLY the enum fields timeBlock ("morning"|"afternoon"|"evening"|"night") and difficulty ("Easy"|"Moderate"|"Challenging") in English.'
          : 'Write all fields in clear, practical English.';
      const locationName = profile?.location?.name || airQuality?.locationName || 'Unknown location';
      const scaleLabel = activeScale === 'IN_NAQI' ? 'Indian National AQI (CPCB)' : 'US EPA AQI';
      const aqiVal =
        activeScale === 'IN_NAQI'
          ? airQuality?.scales?.IN_NAQI?.value
          : airQuality?.scales?.US_EPA?.value;

      const contextText = `
User Context:
- Location: ${locationName} (${profile?.location?.country || ''})
- Lifestyle: ${profile?.lifestyle || 'general'}
- Household: ${profile?.household?.familyMembers ?? 1} members, children: ${
        profile?.household?.hasChildren ? 'yes' : 'no'
      }, elderly: ${profile?.household?.hasElderly ? 'yes' : 'no'}, pets: ${
        profile?.household?.hasPets ? 'yes' : 'no'
      }, outdoor activity: ${profile?.household?.typicalOutdoorActivity || 'moderate'}
- Preferences: commute=${profile?.preferences?.commuteMode || 'mixed'}, diet=${
        profile?.preferences?.diet || 'flexible'
      }, budget=${profile?.preferences?.budget || 'moderate'}

Air Quality & Weather Context:
- Active Scale: ${scaleLabel}
- Current AQI: ${aqiVal !== null && aqiVal !== undefined ? aqiVal : 'Unavailable'}
- PM2.5: ${airQuality?.pollutants?.pm25 ?? 'N/A'} µg/m³, PM10: ${
        airQuality?.pollutants?.pm10 ?? 'N/A'
      } µg/m³, NO2: ${airQuality?.pollutants?.no2 ?? 'N/A'} µg/m³, O3: ${
        airQuality?.pollutants?.o3 ?? 'N/A'
      } µg/m³
- Temperature: ${airQuality?.weather?.temperature ?? 'N/A'} °C, Humidity: ${
        airQuality?.weather?.humidity ?? 'N/A'
      }%, Wind: ${airQuality?.weather?.windSpeed ?? 'N/A'} km/h
`;

      const response = await generateGeminiWithFallback(ai, {
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
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      res.json({
        generatedAt: new Date().toISOString(),
        locationName,
        aqiSummary: parsed.aqiSummary || 'Personalized clean-air routine generated.',
        safetyNote:
          parsed.safetyNote ||
          'These steps help reduce daily pollution exposure where practical. They do not eliminate exposure or prevent disease.',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      });
    } catch (error) {
      const msg = extractFriendlyGeminiError(error);
      res.status(502).json({ error: `Could not generate AI routine: ${msg}` });
    }
  });

  // Gemini AI Conversational Assistant (SSE Streaming + Weather/AQI Tool Grounding + Model Fallback)
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
      const { messages, profile, airQuality, activeScale, language } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Conversation message is required.' });
        return;
      }

      const scaleLabel = activeScale === 'IN_NAQI' ? 'Indian National AQI (CPCB)' : 'US EPA AQI';
      const aqiVal =
        activeScale === 'IN_NAQI'
          ? airQuality?.scales?.IN_NAQI?.value
          : airQuality?.scales?.US_EPA?.value;

      const systemInstruction = `You are HAWA JANO, a warm, empathetic, knowledgeable, calm, and practical weather, air quality, and environmental health companion.
Domain Scope: You answer questions about:
- Weather conditions, temperature, humidity, wind dispersion, fog/temperature inversions, rain washout, UV, and multi-day weather outlook.
- Air pollution, AQI (Indian NAQI & US EPA), PM2.5, PM10, NO2, O3, CO, winter smog, wildfire smoke, dust storms, and pollution sources.
- Everyday protection: outdoor walks/workouts, children & school commutes, elderly & respiratory safety, N95/FFP2 masks, window ventilation timing, HEPA purifiers & CADR, indoor cooking/incense emissions, and sustainable eco-friendly swaps.
- Multi-city weather & AQI lookups/comparisons: Whenever the user asks about weather or air quality in ANY specific city, town, or PIN code (or asks even about their own active location if weather forecast/UV/precipitation is missing from the snapshot below), call the \`lookup_city_weather_and_air_quality\` tool first to fetch live data instead of guessing.

Languages: You naturally understand and reply in English, Hindi (Devanagari or Romanized), or Hinglish.
Active Interface Language: ${language === 'hi' ? 'Hindi (हिन्दी)' : 'English'}. Match the user's message language naturally; if the active UI language is Hindi and the user writes in Hindi or asks generally, respond in clear, empathetic Hindi (Devanagari).

Current User & Active Location Context:
- Location: ${profile?.location?.name || 'Not yet selected'} (${profile?.location?.country || ''})
- AQI Scale: ${scaleLabel}
- Latest AQI: ${aqiVal !== null && aqiVal !== undefined ? `${aqiVal} (Dominant: ${
        activeScale === 'IN_NAQI'
          ? airQuality?.scales?.IN_NAQI?.dominantPollutant || 'N/A'
          : airQuality?.scales?.US_EPA?.dominantPollutant || 'N/A'
      })` : 'Live air quality data is currently unavailable'}
- Pollutants: PM2.5=${airQuality?.pollutants?.pm25 ?? 'N/A'} µg/m³, PM10=${
        airQuality?.pollutants?.pm10 ?? 'N/A'
      } µg/m³, NO2=${airQuality?.pollutants?.no2 ?? 'N/A'} µg/m³, O3=${
        airQuality?.pollutants?.o3 ?? 'N/A'
      } µg/m³, CO=${airQuality?.pollutants?.co ?? 'N/A'} µg/m³
- Weather: Temp=${airQuality?.weather?.temperature ?? 'N/A'} °C, Humidity=${
        airQuality?.weather?.humidity ?? 'N/A'
      }%, Wind=${airQuality?.weather?.windSpeed ?? 'N/A'} km/h (${
        airQuality?.weather?.weatherLabel ?? 'N/A'
      })
- Lifestyle: ${profile?.lifestyle || 'General'}
- Household: ${profile?.household?.familyMembers ?? 1} people, children=${
        profile?.household?.hasChildren ? 'yes' : 'no'
      }, elderly=${profile?.household?.hasElderly ? 'yes' : 'no'}, pets=${
        profile?.household?.hasPets ? 'yes' : 'no'
      }
- Preferences: commute=${profile?.preferences?.commuteMode || 'N/A'}, diet=${
        profile?.preferences?.diet || 'N/A'
      }, budget=${profile?.preferences?.budget || 'N/A'}

Mandatory Safety & Grounding Rules:
1. Reference real location, weather, and pollutant readings from either the active context above or the \`lookup_city_weather_and_air_quality\` tool. If live data cannot be fetched, state that transparently rather than fabricating numbers.
2. NEVER diagnose medical conditions or replace professional medical advice.
3. For severe or hazardous pollution: recommend following local public-health guidance, explain practical exposure-reduction steps, and advise seeking urgent medical attention for serious breathing difficulty, chest pain, wheezing, or emergency symptoms.
4. NEVER provide false reassurance about hazardous air quality or claim an action eliminates all exposure.
5. Format clearly using short headings/bold labels and scannable bullet points.`;

      const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = messages
        .filter((m: { role?: string; content?: string }) => m && typeof m.content === 'string' && m.content.trim().length > 0)
        .slice(-14)
        .map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      if (contents.length === 0) {
        res.status(400).json({ error: 'Conversation message cannot be empty.' });
        return;
      }

      const toolConfig = {
        systemInstruction,
        tools: [{ functionDeclarations: [lookupWeatherAndAqiDeclaration] }],
      };

      // Tool-calling pre-pass (up to 2 rounds) so live weather/AQI lookups work seamlessly
      let finalDirectText: string | null = null;
      for (let round = 0; round < 2; round++) {
        const turnResp = await generateGeminiWithFallback(ai, {
          contents,
          config: toolConfig,
        });

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
                  : profile?.location?.name || '';
              let resultData: Record<string, unknown>;
              try {
                resultData = (await lookupCityWeatherAndAirQuality(locArg)) as Record<string, unknown>;
              } catch (err) {
                resultData = {
                  error: err instanceof Error ? err.message : 'Weather & AQI lookup failed',
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
                name: call.name,
                id: call.id,
                response: { error: `Unknown tool: ${call.name}` },
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
        // Stream in crisp segments for immediate feedback without making a redundant second API call
        const chunkSize = 48;
        for (let i = 0; i < finalDirectText.length; i += chunkSize) {
          res.write(`data: ${JSON.stringify({ text: finalDirectText.slice(i, i + chunkSize) })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }

      // After tool responses were appended, stream final grounded synthesis
      for await (const text of streamGeminiWithFallback(ai, {
        contents,
        config: { systemInstruction },
      })) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      const friendly = extractFriendlyGeminiError(error);
      if (!res.headersSent) {
        res.status(502).json({ error: `AI Assistant error: ${friendly}` });
      } else {
        res.write(`data: ${JSON.stringify({ error: `AI Assistant error: ${friendly}` })}\n\n`);
        res.end();
      }
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HAWA JANO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
