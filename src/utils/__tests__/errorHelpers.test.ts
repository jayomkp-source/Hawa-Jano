import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { mapLocationErrorMessage } from '../errorHelpers';
import { LOCATION_ERROR_MESSAGES } from '../../services/airQualityService';
import { getCommunityInitiatives, getEcoAlternatives } from '../../data/ecoAndCommunityData';

const mockT = ((key: string) => key) as unknown as TFunction;

describe('errorHelpers & dataset integrity', () => {
  it('maps raw HTML, Unexpected token, network, and validation errors cleanly', () => {
    expect(
      mapLocationErrorMessage(new Error(LOCATION_ERROR_MESSAGES.INVALID_PIN), mockT)
    ).toBe('modals.invalidPin');
    expect(
      mapLocationErrorMessage(new Error(LOCATION_ERROR_MESSAGES.NETWORK), mockT)
    ).toBe('modals.networkError');
    expect(
      mapLocationErrorMessage(new Error(LOCATION_ERROR_MESSAGES.LOCATION_SERVICE), mockT)
    ).toBe('modals.locationSearchError');
    expect(
      mapLocationErrorMessage(
        new Error("Unexpected token 'T', \"The page c\"... is not valid JSON"),
        mockT
      )
    ).toBe('modals.locationSearchError');
    expect(mapLocationErrorMessage(new Error('Custom friendly hint'), mockT)).toBe(
      'Custom friendly hint'
    );
    expect(mapLocationErrorMessage('non-error-value', mockT)).toBe('modals.locationSearchError');
  });

  it('ensures bilingual EcoAlternatives and CommunityInitiatives datasets stay aligned and complete', () => {
    const ecoEn = getEcoAlternatives('en');
    const ecoHi = getEcoAlternatives('hi');
    expect(ecoEn.length).toBeGreaterThanOrEqual(8);
    expect(ecoHi.length).toBe(ecoEn.length);
    for (const item of [...ecoEn, ...ecoHi]) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.estimatedEmissionsDeltaKgPerWeek).toBeGreaterThan(0);
    }

    const commEn = getCommunityInitiatives('en');
    const commHi = getCommunityInitiatives('hi');
    expect(commEn.length).toBeGreaterThanOrEqual(6);
    expect(commHi.length).toBe(commEn.length);
    for (const item of [...commEn, ...commHi]) {
      expect(item.steps.length).toBeGreaterThanOrEqual(2);
      expect(item.shareMessage).toBeTruthy();
    }
  });
});
