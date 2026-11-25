import {
  computeIndianNaqi,
  toFiniteNumber,
  toNonNegativeNumber,
} from '../../src/utils/aqi.ts';
import { getValidCache, setBoundedCache, type CacheEntry } from '../utils/cache.ts';
import { sanitizePromptText, type JsonFetcher } from '../utils/upstream.ts';

const AQ_CACHE_TTL_MS = 10 * 60 * 1000;
const AQ_HISTORY_CACHE_TTL_MS = 30 * 60 * 1000;

export function weatherCodeToLabel(code: number | null): string {
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

export async function getLiveAirQualitySnapshot(params: {
  lat: number;
  lon: number;
  locationName: string;
  countryCode: string;
  fetchJson: JsonFetcher;
  cache: Map<string, CacheEntry<unknown>>;
  nowFn: () => number;
}): Promise<unknown> {
  const { lat, lon, locationName, countryCode, fetchJson, cache, nowFn } = params;

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = getValidCache(cache, cacheKey, nowFn());
  if (cached) {
    return cached;
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
    fetchJson(aqUrl, 10000) as Promise<{
      current?: Record<string, unknown>;
      hourly?: Record<string, unknown[]>;
    }>,
    fetchJson(weatherUrl, 10000) as Promise<{
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
      const waqiRes = (await fetchJson(waqiUrl, 5000)) as {
        status?: string;
        data?: {
          aqi?: number;
          city?: { name?: string };
          time?: { iso?: string };
          attributions?: Array<{ name?: string }>;
        };
      };
      if (waqiRes.status === 'ok' && waqiRes.data) {
        const rawStation = waqiRes.data.city?.name?.trim();
        const agency = waqiRes.data.attributions?.[0]?.name?.trim();
        stationName = rawStation
          ? agency
            ? `${rawStation} (${agency})`
            : rawStation
          : undefined;
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

  setBoundedCache(cache, cacheKey, payload, AQ_CACHE_TTL_MS, nowFn());
  return payload;
}

export async function getHistoricalAirQualityTrends(params: {
  lat: number;
  lon: number;
  days: 7 | 30;
  locationName: string;
  fetchJson: JsonFetcher;
  cache: Map<string, CacheEntry<unknown>>;
  nowFn: () => number;
}): Promise<unknown> {
  const { lat, lon, days, locationName, fetchJson, cache, nowFn } = params;

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)},${days}`;
  const cached = getValidCache(cache, cacheKey, nowFn());
  if (cached) {
    return cached;
  }

  const histUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    `&hourly=pm10,pm2_5,nitrogen_dioxide,ozone,us_aqi` +
    `&past_days=${days}&forecast_days=0&timezone=auto`;

  const raw = (await fetchJson(histUrl, 12000)) as {
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
    locationName: sanitizePromptText(locationName, 120) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    days,
    source: 'Open-Meteo Copernicus CAMS Historical Archive',
    fetchedAt: new Date(nowFn()).toISOString(),
    daily,
  };

  setBoundedCache(cache, cacheKey, payload, AQ_HISTORY_CACHE_TTL_MS, nowFn());
  return payload;
}
