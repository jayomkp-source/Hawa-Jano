import type {
  AirQualitySnapshot,
  GeocodeResult,
  HistoricalAirQualityResponse,
  LocationData,
} from '../types';

const AQ_CACHE_STORAGE_KEY = 'airwise_last_aq_snapshot_v1';

export async function searchLocations(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to search locations.');
  }
  return Array.isArray(data.results) ? data.results : [];
}

export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number
): Promise<GeocodeResult> {
  const res = await fetch(
    `/api/geocode?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
  );
  const data = await res.json();
  if (!res.ok || !Array.isArray(data.results) || data.results.length === 0) {
    return {
      name: `Coordinates (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
      city: 'Current Location',
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
    throw new Error('Browser geolocation is not supported on this device. Please enter your city or PIN code.');
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  }).catch((err: GeolocationPositionError) => {
    if (err.code === 1) {
      throw new Error('Location permission was denied. You can enter your city or PIN code manually instead.');
    }
    if (err.code === 2) {
      throw new Error('Location signal unavailable. Please enter your city or PIN code manually.');
    }
    if (err.code === 3) {
      throw new Error('Location request timed out. Please try again or enter your city manually.');
    }
    throw new Error('Unable to detect location automatically.');
  });

  const { latitude, longitude } = position.coords;
  const geo = await reverseGeocodeCoords(latitude, longitude);

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

  const res = await fetch(`/api/air-quality?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Live air quality data is currently unavailable.');
  }

  saveCachedAirQuality(data as AirQualitySnapshot);
  return data as AirQualitySnapshot;
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

  const res = await fetch(`/api/air-quality/history?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Historical air quality data is currently unavailable.');
  }
  return data as HistoricalAirQualityResponse;
}
