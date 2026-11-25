import { describe, expect, it } from 'vitest';
import {
  computeIndianNaqi,
  getAqiCategory,
  getScaleShortName,
  getScaleTitle,
  inferLikelyContributors,
  isAirQualityStale,
  resolveActiveScale,
  toFiniteNumber,
  toNonNegativeNumber,
} from '../aqi';
import type { LocationData } from '../../types';

const delhiLocation: LocationData = {
  name: 'New Delhi, Delhi',
  city: 'New Delhi',
  region: 'Delhi',
  country: 'India',
  countryCode: 'IN',
  latitude: 28.6139,
  longitude: 77.209,
  source: 'manual',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

const londonLocation: LocationData = {
  name: 'London, England',
  city: 'London',
  region: 'England',
  country: 'United Kingdom',
  countryCode: 'GB',
  latitude: 51.5072,
  longitude: -0.1276,
  source: 'manual',
  updatedAt: '2026-11-25T10:00:00.000Z',
};

describe('aqi utilities (Section C)', () => {
  it('validates finite and non-negative numeric measurements', () => {
    expect(toFiniteNumber(42)).toBe(42);
    expect(toFiniteNumber(-5)).toBe(-5);
    expect(toFiniteNumber(NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber('42')).toBeNull();

    expect(toNonNegativeNumber(0)).toBe(0);
    expect(toNonNegativeNumber(125.4)).toBe(125.4);
    expect(toNonNegativeNumber(-0.1)).toBeNull();
    expect(toNonNegativeNumber(NaN)).toBeNull();
  });

  it('computes Indian NAQI accurately across CPCB breakpoints and picks dominant pollutant', () => {
    const good = computeIndianNaqi({
      pm25: 15,
      pm10: 30,
      no2: 20,
      o3: 25,
      co: 500,
      so2: 10,
    });
    expect(good.value).toBe(30);
    expect(good.dominantPollutant).toBe('PM10');

    const poor = computeIndianNaqi({
      pm25: 105,
      pm10: 180,
      no2: 90,
      o3: 60,
      co: 1200,
      so2: 30,
    });
    expect(poor.value).toBeGreaterThanOrEqual(201);
    expect(poor.value).toBeLessThanOrEqual(300);
    expect(poor.dominantPollutant).toBe('PM2.5');

    const extreme = computeIndianNaqi({
      pm25: 800,
      pm10: 900,
      no2: null,
      o3: null,
      co: null,
      so2: null,
    });
    expect(extreme.value).toBeLessThanOrEqual(999);
    expect(extreme.dominantPollutant).toBe('PM2.5');
  });

  it('returns null NAQI when all pollutant measurements are missing or negative', () => {
    expect(
      computeIndianNaqi({
        pm25: null,
        pm10: null,
        no2: null,
        o3: null,
        co: null,
        so2: null,
      })
    ).toEqual({ value: null, dominantPollutant: null });

    expect(
      computeIndianNaqi({
        pm25: -10,
        pm10: NaN,
        no2: Infinity,
        o3: -1,
        co: -500,
        so2: null,
      })
    ).toEqual({ value: null, dominantPollutant: null });
  });

  it('resolves IN_NAQI vs US_EPA scale automatically from location or explicit preference', () => {
    expect(resolveActiveScale('auto', delhiLocation)).toBe('IN_NAQI');
    expect(resolveActiveScale('auto', londonLocation)).toBe('US_EPA');
    expect(resolveActiveScale('auto', null)).toBe('IN_NAQI');
    expect(resolveActiveScale('US_EPA', delhiLocation)).toBe('US_EPA');
    expect(resolveActiveScale('IN_NAQI', londonLocation)).toBe('IN_NAQI');
    expect(getScaleTitle('IN_NAQI')).toContain('CPCB');
    expect(getScaleShortName('US_EPA')).toBe('US AQI');
  });

  it('classifies CPCB IN_NAQI and US_EPA bands accurately including unavailable state', () => {
    expect(getAqiCategory(null, 'IN_NAQI').band).toBe('unavailable');
    expect(getAqiCategory(40, 'IN_NAQI').band).toBe('good');
    expect(getAqiCategory(80, 'IN_NAQI').band).toBe('satisfactory');
    expect(getAqiCategory(150, 'IN_NAQI').band).toBe('moderate');
    expect(getAqiCategory(250, 'IN_NAQI').band).toBe('poor');
    expect(getAqiCategory(350, 'IN_NAQI').band).toBe('very-poor');
    expect(getAqiCategory(440, 'IN_NAQI').band).toBe('severe');

    expect(getAqiCategory(35, 'US_EPA').exerciseSafe).toBe(true);
    expect(getAqiCategory(140, 'US_EPA').band).toBe('poor');
    expect(getAqiCategory(140, 'US_EPA').exerciseSafe).toBe(false);
    expect(getAqiCategory(350, 'US_EPA').band).toBe('severe');
  });

  it('detects stale readings based on timestamp age and invalid timestamps', () => {
    const nowMs = new Date('2026-11-25T12:00:00.000Z').getTime();
    expect(isAirQualityStale('2026-11-25T10:30:00.000Z', 3, nowMs)).toBe(false);
    expect(isAirQualityStale('2026-11-25T08:00:00.000Z', 3, nowMs)).toBe(true);
    expect(isAirQualityStale('not-a-date', 3, nowMs)).toBe(true);
    expect(isAirQualityStale(null, 3, nowMs)).toBe(true);
  });

  it('infers likely contributor patterns in English and Hindi', () => {
    const fineEn = inferLikelyContributors(
      { pm25: 120, pm10: 160, no2: 65, o3: 110, co: 2100, so2: 12 },
      'en'
    );
    expect(fineEn.some((s) => s.includes('PM2.5/PM10'))).toBe(true);
    expect(fineEn.some((s) => s.includes('NO2'))).toBe(true);
    expect(fineEn.some((s) => s.includes('ozone'))).toBe(true);
    expect(fineEn.some((s) => s.includes('carbon monoxide'))).toBe(true);

    const coarseHi = inferLikelyContributors(
      { pm25: 40, pm10: 150, no2: 20, o3: 40, co: 400, so2: 5 },
      'hi'
    );
    expect(coarseHi[0]).toContain('PM10');

    const calm = inferLikelyContributors(
      { pm25: 12, pm10: 25, no2: 15, o3: 30, co: 300, so2: 5 },
      'en'
    );
    expect(calm).toHaveLength(1);
    expect(calm[0]).toContain('do not show');
  });
});
