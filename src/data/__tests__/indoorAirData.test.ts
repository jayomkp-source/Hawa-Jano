import { describe, expect, it } from 'vitest';
import {
  INDOOR_OCCUPANTS_MAX,
  INDOOR_ROOM_MAX_SQFT,
  INDOOR_ROOM_MIN_SQFT,
  calculateIndoorRecommendation,
  getIndoorChecklistItems,
} from '../indoorAirData';

describe('indoorAirData (Section E)', () => {
  it('computes scaled CADR and higher air-change target when outdoor AQI > 200', () => {
    const moderateRes = calculateIndoorRecommendation(
      {
        roomSizeSqFt: 200,
        occupants: 2,
        filtrationSetup: 'none',
        budget: 'moderate',
        outdoorAqi: 120,
        ventilationSafe: false,
      },
      'en'
    );

    const severeRes = calculateIndoorRecommendation(
      {
        roomSizeSqFt: 200,
        occupants: 4,
        filtrationSetup: 'none',
        budget: 'flexible',
        outdoorAqi: 340,
        ventilationSafe: false,
      },
      'en'
    );

    expect(moderateRes.targetAch).toBe(4);
    expect(severeRes.targetAch).toBe(5);
    expect(severeRes.recommendedCadrM3h).toBeGreaterThan(moderateRes.recommendedCadrM3h);
    expect(severeRes.recommendedCadrCfm).toBeGreaterThan(0);
    expect(moderateRes.inputWarning).toBeUndefined();
    expect(moderateRes.priorityStrategy).toContain('True HEPA (H13)');
  });

  it('tailors purifier, zero-cost, and ventilation directives by setup and language', () => {
    const zeroCostOpenWindow = calculateIndoorRecommendation(
      {
        roomSizeSqFt: 160,
        occupants: 2,
        filtrationSetup: 'none',
        budget: 'zero-low',
        outdoorAqi: 42,
        ventilationSafe: true,
      },
      'en'
    );
    expect(zeroCostOpenWindow.priorityStrategy).toContain('source elimination');
    expect(zeroCostOpenWindow.ventilationDirective).toContain('15–20 min');

    const hepaHi = calculateIndoorRecommendation(
      {
        roomSizeSqFt: 180,
        occupants: 2,
        filtrationSetup: 'hepa-single',
        budget: 'flexible',
        outdoorAqi: 260,
        ventilationSafe: false,
      },
      'hi'
    );
    expect(hepaHi.priorityStrategy).toContain('प्री-फ़िल्टर');
    expect(hepaHi.ventilationDirective).toContain('खिड़कियां बंद');
    expect(getIndoorChecklistItems('hi').length).toBe(getIndoorChecklistItems('en').length);
  });

  it('safely clamps negative, NaN, and oversized room/occupant inputs with a clear warning', () => {
    const invalidRes = calculateIndoorRecommendation(
      {
        roomSizeSqFt: -50,
        occupants: Number.NaN,
        filtrationSetup: 'basic-fan',
        budget: 'moderate',
        outdoorAqi: -20,
        ventilationSafe: false,
      },
      'en'
    );

    expect(invalidRes.inputWarning).toContain(String(INDOOR_ROOM_MIN_SQFT));
    expect(Number.isFinite(invalidRes.recommendedCadrM3h)).toBe(true);
    expect(invalidRes.recommendedCadrM3h).toBeGreaterThan(0);
    expect(invalidRes.priorityStrategy).toContain('Avoid ionizers');

    const oversizedRes = calculateIndoorRecommendation(
      {
        roomSizeSqFt: 999999,
        occupants: 500,
        filtrationSetup: 'hepa-high-cadr',
        budget: 'flexible',
        outdoorAqi: 250,
        ventilationSafe: false,
      },
      'hi'
    );

    expect(oversizedRes.inputWarning).toContain(String(INDOOR_ROOM_MAX_SQFT));
    expect(oversizedRes.inputWarning).toContain(String(INDOOR_OCCUPANTS_MAX));
    expect(Number.isFinite(oversizedRes.recommendedCadrM3h)).toBe(true);
  });
});
