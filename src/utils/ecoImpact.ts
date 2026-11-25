import type { EcoAlternative } from '../types';

export interface EcoImpactSummary {
  committedCount: number;
  weeklyKg: number;
  monthlyInr: number;
  monthlyUsd: number;
  skippedInvalidEntries: number;
}

function toSafePositiveNumber(val: unknown): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    return null;
  }
  return val;
}

export function calculateEcoImpactSummary(
  alternatives: ReadonlyArray<EcoAlternative> | null | undefined,
  committedIds: ReadonlyArray<string> | null | undefined
): EcoImpactSummary {
  if (!Array.isArray(alternatives) || !Array.isArray(committedIds) || committedIds.length === 0) {
    return {
      committedCount: 0,
      weeklyKg: 0,
      monthlyInr: 0,
      monthlyUsd: 0,
      skippedInvalidEntries: 0,
    };
  }

  const uniqueCommitted = new Set(
    committedIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  );
  const committedItems = alternatives.filter((item) => item && uniqueCommitted.has(item.id));

  let weeklyKg = 0;
  let monthlyInr = 0;
  let monthlyUsd = 0;
  let skippedInvalidEntries = 0;

  for (const item of committedItems) {
    const kg = toSafePositiveNumber(item.estimatedEmissionsDeltaKgPerWeek);
    if (kg === null) {
      skippedInvalidEntries += 1;
    } else {
      weeklyKg += kg;
    }

    if (item.estimatedMoneySavedPerMonthInr !== null && item.estimatedMoneySavedPerMonthInr !== undefined) {
      const inr = toSafePositiveNumber(item.estimatedMoneySavedPerMonthInr);
      if (inr === null) {
        skippedInvalidEntries += 1;
      } else {
        monthlyInr += inr;
      }
    }

    if (item.estimatedMoneySavedPerMonthUsd !== null && item.estimatedMoneySavedPerMonthUsd !== undefined) {
      const usd = toSafePositiveNumber(item.estimatedMoneySavedPerMonthUsd);
      if (usd === null) {
        skippedInvalidEntries += 1;
      } else {
        monthlyUsd += usd;
      }
    }
  }

  return {
    committedCount: committedItems.length,
    weeklyKg: Number(weeklyKg.toFixed(2)),
    monthlyInr: Math.round(monthlyInr),
    monthlyUsd: Math.round(monthlyUsd),
    skippedInvalidEntries,
  };
}

export function formatEcoMoneyEstimate(
  item: Pick<EcoAlternative, 'estimatedMoneySavedPerMonthInr' | 'estimatedMoneySavedPerMonthUsd'>,
  useInr: boolean,
  estimateLabel: string
): string {
  if (useInr) {
    const inr = toSafePositiveNumber(item.estimatedMoneySavedPerMonthInr);
    return inr !== null && inr > 0 ? `~₹${inr}/mo (${estimateLabel})` : '—';
  }
  const usd = toSafePositiveNumber(item.estimatedMoneySavedPerMonthUsd);
  return usd !== null && usd > 0 ? `~$${usd}/mo (${estimateLabel})` : '—';
}
