import type {
  AirQualitySnapshot,
  GeocodeResult,
  HistoricalAirQualityResponse,
  LocationData,
} from '../types';

const AQ_CACHE_STORAGE_KEY = 'airwise_last_aq_snapshot_v1';

export const LOCATION_ERROR_MESSAGES = {
  INVALID_PIN: 'Please enter a valid 6-digit PIN code.',
  NO_LOCATION_FOUND: 'No location found. Please check your PIN code.',
  NETWORK: 'Unable to connect. Check your internet connection and try again.',
  LOCATION_SERVICE: 'Location service is temporarily unavailable.',
  STATION_UNAVAILABLE: 'No nearby verified air-quality monitoring station is currently available.',
} as const;

function sanitizeApiErrorMessage(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (
    /unexpected token|is not valid json|<!doctype|<html|<body|the page cannot be displayed|^the page /i.test(
      trimmed
    )
  ) {
    return fallback;
  }
  return trimmed;
}

export async function parseApiJson<T>(
  res: Response,
  fallbackServiceError: string
): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error(fallbackServiceError);
  }

  if (
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml') ||
    trimmed.startsWith('<') ||
    /^<!doctype/i.test(trimmed) ||
    /^the page /i.test(trimmed)
  ) {
    throw new Error(fallbackServiceError);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(fallbackServiceError);
  }

  if (!res.ok) {
    const serverError =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as { error?: unknown }).error
        : undefined;
    throw new Error(sanitizeApiErrorMessage(serverError, fallbackServiceError));
  }

  return parsed as T;
}

async function fetchWithNetworkHandling(url: string): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(LOCATION_ERROR_MESSAGES.NETWORK);
  }
  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error(LOCATION_ERROR_MESSAGES.NETWORK);
  }
}

export function validateLocationSearchInput(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error(LOCATION_ERROR_MESSAGES.INVALID_PIN);
  }
  if (/^\d+$/.test(trimmed) && !/^\d{6}$/.test(trimmed)) {
    throw new Error(LOCATION_ERROR_MESSAGES.INVALID_PIN);
  }
  if (trimmed.length < 2) {
    throw new Error(LOCATION_ERROR_MESSAGES.INVALID_PIN);
  }
  return trimmed;
}

export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  const validated = validateLocationSearchInput(query);
  const res = await fetchWithNetworkHandling(
    `/api/geocode?q=${encodeURIComponent(validated)}`
  );
  const data = await parseApiJson<{ results?: GeocodeResult[] }>(
    res,
    LOCATION_ERROR_MESSAGES.LOCATION_SERVICE
  );
  return Array.isArray(data.results) ? data.results : [];
}

export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number
): Promise<GeocodeResult> {
  const res = await fetchWithNetworkHandling(
    `/api/geocode?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
  );
  const data = await parseApiJson<{ results?: GeocodeResult[] }>(
    res,
    LOCATION_ERROR_MESSAGES.LOCATION_SERVICE
  );
  if (!Array.isArray(data.results) || data.results.length === 0) {
    return {
      name: `Coordinates (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
      city: 'Current Location',
      district: '',
      region: '',
      country: '',
      countryCode: '',
      latitude,
      longitude,
    };
  }
  return data.results[0];
}

export async function requestBrowserLocation(): Promise<LocationData> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error(
      'Browser geolocation is not supported on this device. Please enter your 6-digit PIN code or city.'
    );
  }

  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error(
      'Browser location requires a secure HTTPS connection. Please enter your 6-digit PIN code or city.'
    );
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  }).catch((err: GeolocationPositionError) => {
    if (err.code === 1) {
      throw new Error(
        'Location permission was denied. You can enter your 6-digit PIN code or city manually instead.'
      );
    }
    if (err.code === 2) {
      throw new Error(
        'Location signal is unavailable. Please enter your 6-digit PIN code or city manually.'
      );
    }
    if (err.code === 3) {
      throw new Error(
        'Location request timed out. Please try again or enter your 6-digit PIN code manually.'
      );
    }
    throw new Error('Unable to detect browser location automatically.');
  });

  const { latitude, longitude } = position.coords;

  let geo: GeocodeResult;
  try {
    geo = await reverseGeocodeCoords(latitude, longitude);
  } catch (err) {
    if (err instanceof Error && err.message === LOCATION_ERROR_MESSAGES.NETWORK) {
      throw err;
    }
    geo = {
      name: `Coordinates (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
      city: 'Current Location',
      district: '',
      region: '',
      country: '',
      countryCode: '',
      latitude,
      longitude,
    };
  }

  return {
    ...geo,
    source: 'geolocation',
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchLiveAirQuality(location: LocationData): Promise<AirQualitySnapshot> {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    countryCode: location.countryCode || '',
  });

  const res = await fetchWithNetworkHandling(`/api/air-quality?${params.toString()}`);
  const data = await parseApiJson<AirQualitySnapshot>(
    res,
    LOCATION_ERROR_MESSAGES.STATION_UNAVAILABLE
  );

  saveCachedAirQuality(data);
  return data;
}

export function saveCachedAirQuality(snapshot: AirQualitySnapshot): void {
  try {
    localStorage.setItem(AQ_CACHE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadCachedAirQuality(location?: LocationData | null): AirQualitySnapshot | null {
  try {
    const raw = localStorage.getItem(AQ_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AirQualitySnapshot;
    if (location) {
      const distLat = Math.abs(parsed.latitude - location.latitude);
      const distLon = Math.abs(parsed.longitude - location.longitude);
      if (distLat > 0.5 || distLon > 0.5) {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchHistoricalAirQuality(
  location: LocationData,
  days: 7 | 30
): Promise<HistoricalAirQualityResponse> {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    days: String(days),
    name: location.name,
  });

  const res = await fetchWithNetworkHandling(`/api/air-quality/history?${params.toString()}`);
  return await parseApiJson<HistoricalAirQualityResponse>(
    res,
    'Historical air quality data is currently unavailable.'
  );
}
