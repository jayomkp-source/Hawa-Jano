import { describe, expect, it } from 'vitest';
import { getEcoAlternatives } from '../../data/ecoAndCommunityData';
import type { EcoAlternative } from '../../types';
import { calculateEcoImpactSummary, formatEcoMoneyEstimate } from '../ecoImpact';

describe('ecoImpact utilities (Section F)', () => {
  it('calculates total weekly CO2e and monthly INR/USD savings accurately', () => {
    const items = getEcoAlternatives('en');
    const summary = calculateEcoImpactSummary(items, [items[0].id, items[1].id, items[0].id]);

    expect(summary.committedCount).toBe(2);
    expect(summary.weeklyKg).toBe(
      Number(
        (items[0].estimatedEmissionsDeltaKgPerWeek + items[1].estimatedEmissionsDeltaKgPerWeek).toFixed(2)
      )
    );
    expect(summary.monthlyInr).toBe(
      (items[0].estimatedMoneySavedPerMonthInr ?? 0) + (items[1].estimatedMoneySavedPerMonthInr ?? 0)
    );
    expect(summary.skippedInvalidEntries).toBe(0);
  });

  it('handles missing currency data and empty/null inputs cleanly', () => {
    const empty = calculateEcoImpactSummary(null, []);
    expect(empty).toEqual({
      committedCount: 0,
      weeklyKg: 0,
      monthlyInr: 0,
      monthlyUsd: 0,
      skippedInvalidEntries: 0,
    });

    const partialItem: EcoAlternative = {
      id: 'partial',
      category: 'household',
      title: 'Clean cooking',
      originalActivity: 'Gas',
      sustainableAlternative: 'Induction',
      environmentalBenefit: 'Lower indoor NO2',
      estimatedEmissionsDeltaKgPerWeek: 4.5,
      emissionsAssumption: 'Estimated grid mix delta',
      estimatedMoneySavedPerMonthInr: null,
      estimatedMoneySavedPerMonthUsd: null,
      moneyAssumption: 'Tariff dependent',
      difficulty: 'Moderate',
      directImpact: 'Reduces indoor NO2',
      personalBenefit: 'Cleaner kitchen air',
      communityBenefit: 'Lower LPG cylinder transport',
      personalExposureNote: 'Ventilate during frying',
    };

    const res = calculateEcoImpactSummary([partialItem], ['partial', 'non-existent', '']);
    expect(res.committedCount).toBe(1);
    expect(res.weeklyKg).toBe(4.5);
    expect(res.monthlyInr).toBe(0);
    expect(res.monthlyUsd).toBe(0);
    expect(formatEcoMoneyEstimate(partialItem, true, 'estimate')).toBe('—');
    expect(formatEcoMoneyEstimate(partialItem, false, 'estimate')).toBe('—');
  });

  it('skips and counts invalid negative or NaN values without producing NaN totals', () => {
    const corruptItem = {
      id: 'bad-1',
      category: 'transport',
      title: 'Corrupt',
      originalActivity: 'Car',
      sustainableAlternative: 'Bike',
      environmentalBenefit: 'Zero tailpipe',
      estimatedEmissionsDeltaKgPerWeek: -12,
      estimatedMoneySavedPerMonthInr: Number.NaN,
      estimatedMoneySavedPerMonthUsd: -50,
      moneyAssumption: 'N/A',
      difficulty: 'Easy',
    } as EcoAlternative;

    const summary = calculateEcoImpactSummary([corruptItem], ['bad-1']);
    expect(summary.committedCount).toBe(1);
    expect(summary.weeklyKg).toBe(0);
    expect(summary.monthlyInr).toBe(0);
    expect(summary.monthlyUsd).toBe(0);
    expect(summary.skippedInvalidEntries).toBe(3);
    expect(formatEcoMoneyEstimate(corruptItem, true, 'estimate')).toBe('—');
    expect(formatEcoMoneyEstimate(corruptItem, false, 'estimate')).toBe('—');
  });
});
