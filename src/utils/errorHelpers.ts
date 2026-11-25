import type { TFunction } from 'i18next';
import { LOCATION_ERROR_MESSAGES } from '../services/airQualityService';

export function mapLocationErrorMessage(err: unknown, t: TFunction): string {
  const msg = err instanceof Error ? err.message : '';
  if (msg === LOCATION_ERROR_MESSAGES.INVALID_PIN) return t('modals.invalidPin');
  if (msg === LOCATION_ERROR_MESSAGES.NETWORK) return t('modals.networkError');
  if (msg === LOCATION_ERROR_MESSAGES.LOCATION_SERVICE) return t('modals.locationSearchError');
  if (!msg || /unexpected token|is not valid json|<!doctype|<html|the page /i.test(msg)) {
    return t('modals.locationSearchError');
  }
  return msg;
}
