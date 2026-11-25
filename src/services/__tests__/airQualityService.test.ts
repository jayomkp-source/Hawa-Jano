import { describe, expect, it, vi } from 'vitest';
import {
  formatLocationDetails,
  isValidLocationSearchQuery,
  LOCATION_ERROR_MESSAGES,
  loadCachedAirQuality,
  requestBrowserLocation,
  saveCachedAirQuality,
  searchLocations,
  fetchLiveAirQuality,
  validateAirQualitySnapshot,
  validateLocationSearchInput,
} from '../airQualityService';
import type { AirQualitySnapshot, LocationData } from '../../types';

const sampleLoc: LocationData = {
  name: 'Connaught Place, Delhi (110001)',
  city: 'Connaught Place',
  district: 'New Delhi',
  region: 'Delhi',
  country: 'India',
  countryCode: 'IN',
  pinCode: '110001',
  latitude: 28.63,
  longitude: 77.22,
  source: 'manual',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

const sampleSnapshot: AirQualitySnapshot = {
  locationName: sampleLoc.name,
  countryCode: 'IN',
  latitude: 28.63,
  longitude: 77.22,
  measuredAt: '2026-11-25T10:00:00.000Z',
  fetchedAt: '2026-11-25T10:01:00.000Z',
  source: 'Open-Meteo Copernicus CAMS & Weather',
  stationCoverage: 'gridded-model',
  pollutants: { pm25: 145, pm10: 210, no2: 52, o3: 38, co: 900, so2: 12 },
  weather: {
    temperature: 22,
    humidity: 58,
    windSpeed: 6,
    windDirection: 280,
    weatherCode: 2,
    weatherLabel: 'Partly cloudy',
    isDay: true,
  },
  scales: {
    IN_NAQI: { value: 318, dominantPollutant: 'PM2.5' },
    US_EPA: { value: 197, dominantPollutant: 'PM2.5' },
  },
  hourly: [],
  previous24hAvgAqi: { IN_NAQI: 290, US_EPA: 180 },
};

describe('airQualityService (Sections B & C)', () => {
  it('validates 6-digit Indian PIN codes, city names, and shared formatting helpers', () => {
    expect(isValidLocationSearchQuery('110001')).toBe(true);
    expect(isValidLocationSearchQuery('1100')).toBe(false);
    expect(
      formatLocationDetails({
        city: 'Connaught Place',
        district: 'New Delhi',
        region: 'Delhi',
        country: 'India',
        pinCode: '110001',
      })
    ).toBe('New Delhi, Delhi, India · PIN 110001');

    expect(validateLocationSearchInput(' 110001 ')).toBe('110001');
    expect(validateLocationSearchInput('Jaipur')).toBe('Jaipur');
    expect(() => validateLocationSearchInput('')).toThrow(LOCATION_ERROR_MESSAGES.INVALID_PIN);
    expect(() => validateLocationSearchInput('1100')).toThrow(LOCATION_ERROR_MESSAGES.INVALID_PIN);
    expect(() => validateLocationSearchInput('1100019')).toThrow(LOCATION_ERROR_MESSAGES.INVALID_PIN);
    expect(() => validateLocationSearchInput('a')).toThrow(LOCATION_ERROR_MESSAGES.INVALID_PIN);
  });

  it('handles location search success, network failure, and HTML/non-JSON upstream error safely', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              name: 'New Delhi, Delhi (110001)',
              city: 'New Delhi',
              district: 'New Delhi',
              region: 'Delhi',
              country: 'India',
              countryCode: 'IN',
              pinCode: '110001',
              latitude: 28.63,
              longitude: 77.22,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const results = await searchLocations('110001');
    expect(results).toHaveLength(1);
    expect(results[0].country).toBe('India');

    // Simulate upstream returning an HTML proxy page instead of JSON
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('The page cannot be displayed', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })
    );
    await expect(searchLocations('110001')).rejects.toThrow(LOCATION_ERROR_MESSAGES.LOCATION_SERVICE);

    // Simulate network failure
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(searchLocations('110001')).rejects.toThrow(LOCATION_ERROR_MESSAGES.NETWORK);
  });

  it('handles browser GPS granted and permission-denied/timeout/unsupported error paths', async () => {
    const getCurrentPosition = vi.fn(
      (success: PositionCallback, _errorCb?: PositionErrorCallback | null) =>
        success({
          coords: {
            latitude: 28.6139,
            longitude: 77.209,
            accuracy: 25,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition)
    );

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              name: 'New Delhi, Delhi',
              city: 'New Delhi',
              region: 'Delhi',
              country: 'India',
              countryCode: 'IN',
              latitude: 28.6139,
              longitude: 77.209,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const loc = await requestBrowserLocation();
    expect(loc.source).toBe('geolocation');
    expect(loc.city).toBe('New Delhi');

    // Permission denied (code 1)
    getCurrentPosition.mockImplementationOnce(
      (_s: PositionCallback, errorCb?: PositionErrorCallback | null) =>
        errorCb?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError)
    );
    await expect(requestBrowserLocation()).rejects.toThrow(/denied/i);

    // Timeout (code 3)
    getCurrentPosition.mockImplementationOnce(
      (_s: PositionCallback, errorCb?: PositionErrorCallback | null) =>
        errorCb?.({ code: 3, message: 'Timeout' } as GeolocationPositionError)
    );
    await expect(requestBrowserLocation()).rejects.toThrow(/timed out/i);

    // Position unavailable (code 2)
    getCurrentPosition.mockImplementationOnce(
      (_s: PositionCallback, errorCb?: PositionErrorCallback | null) =>
        errorCb?.({ code: 2, message: 'Unavailable' } as GeolocationPositionError)
    );
    await expect(requestBrowserLocation()).rejects.toThrow(/signal is unavailable/i);

    // Insecure HTTP context
    const originalSecure = window.isSecureContext;
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    await expect(requestBrowserLocation()).rejects.toThrow(/secure HTTPS/i);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecure,
    });
  });

  it('validates live AQI snapshot payloads, rejects missing measurements, and caches valid readings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(sampleSnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const fetched = await fetchLiveAirQuality(sampleLoc);
    expect(fetched.source).toBe(sampleSnapshot.source);
    expect(fetched.measuredAt).toBe(sampleSnapshot.measuredAt);

    const cached = loadCachedAirQuality(sampleLoc);
    expect(cached?.scales.IN_NAQI.value).toBe(318);

    saveCachedAirQuality(fetched);
    expect(
      loadCachedAirQuality({ ...sampleLoc, latitude: 19.07, longitude: 72.87 })
    ).toBeNull();

    // Missing pollutant structure is rejected
    expect(() => validateAirQualitySnapshot({ locationName: 'Bad' })).toThrow(
      LOCATION_ERROR_MESSAGES.STATION_UNAVAILABLE
    );
  });
});
