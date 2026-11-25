import { describe, expect, it } from 'vitest';
import {
  analyzeAtmosphericDispersion,
  formatWindDirection,
} from '../weatherService';
import type { WeatherData } from '../../types';

const baseWeather: WeatherData = {
  temperature: 22,
  humidity: 55,
  windSpeed: 12,
  windDirection: 270,
  weatherCode: 1,
  weatherLabel: 'Partly cloudy',
  isDay: true,
};

describe('weatherService atmospheric dispersion & wind formatting', () => {
  it('classifies stagnant, moderate, favorable, and unknown wind dispersion in English and Hindi', () => {
    expect(analyzeAtmosphericDispersion(null, 'en').status).toBe('unknown');
    expect(analyzeAtmosphericDispersion({ ...baseWeather, windSpeed: null }, 'hi').status).toBe(
      'unknown'
    );

    const stagnantEn = analyzeAtmosphericDispersion(
      { ...baseWeather, windSpeed: 3.5, humidity: 82, temperature: 10 },
      'en'
    );
    expect(stagnantEn.status).toBe('stagnant');
    expect(stagnantEn.summary).toContain('3.5 km/h');

    const stagnantHi = analyzeAtmosphericDispersion(
      { ...baseWeather, windSpeed: 4, temperature: 12 },
      'hi'
    );
    expect(stagnantHi.status).toBe('stagnant');
    expect(stagnantHi.summary).toContain('4.0');

    const moderate = analyzeAtmosphericDispersion({ ...baseWeather, windSpeed: 6.5 }, 'en');
    expect(moderate.status).toBe('moderate');

    const favorableEn = analyzeAtmosphericDispersion(baseWeather, 'en');
    expect(favorableEn.status).toBe('favorable');

    const favorableHi = analyzeAtmosphericDispersion(baseWeather, 'hi');
    expect(favorableHi.status).toBe('favorable');
  });

  it('formats compass wind direction and handles missing/NaN angles safely', () => {
    expect(formatWindDirection(null)).toBe('—');
    expect(formatWindDirection(Number.NaN)).toBe('—');
    expect(formatWindDirection(0)).toBe('N (0°)');
    expect(formatWindDirection(90)).toBe('E (90°)');
    expect(formatWindDirection(225)).toBe('SW (225°)');
    expect(formatWindDirection(358)).toBe('N (358°)');
  });
});
