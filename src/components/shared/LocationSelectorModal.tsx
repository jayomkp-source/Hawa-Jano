import React, { useEffect, useState } from 'react';
import { Check, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import {
  LOCATION_ERROR_MESSAGES,
  requestBrowserLocation,
  searchLocations,
} from '../../services/airQualityService';
import type { GeocodeResult } from '../../types';
import { mapLocationErrorMessage } from '../../utils/errorHelpers';

export const LocationSelectorModal: React.FC = () => {
  const { t } = useTranslation();
  const { isLocationModalOpen, setIsLocationModalOpen, setLocation, profile } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GeocodeResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLocationModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLocationModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLocationModalOpen, setIsLocationModalOpen]);

  if (!isLocationModalOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || (/^\d+$/.test(trimmed) && !/^\d{6}$/.test(trimmed)) || trimmed.length < 2) {
      setResults([]);
      setSelectedResult(null);
      setError(t('modals.invalidPin'));
      return;
    }

    setSearching(true);
    setError(null);
    setSelectedResult(null);
    try {
      const found = await searchLocations(trimmed);
      setResults(found);
      if (found.length === 0) {
        setError(t('modals.noLocationMatch'));
      } else if (found.length === 1) {
        setSelectedResult(found[0]);
      }
    } catch (err) {
      setResults([]);
      setError(mapLocationErrorMessage(err, t));
    } finally {
      setSearching(false);
    }
  };

  const handleDetectLocation = async () => {
    setGeoLoading(true);
    setError(null);
    try {
      const loc = await requestBrowserLocation();
      setLocation(loc);
      setIsLocationModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === LOCATION_ERROR_MESSAGES.NETWORK) {
        setError(t('modals.networkError'));
      } else if (!msg || /unexpected token|is not valid json|<!doctype|<html/i.test(msg)) {
        setError(t('modals.locationAccessError'));
      } else {
        setError(msg);
      }
    } finally {
      setGeoLoading(false);
    }
  };

  const handleConfirmSelected = () => {
    if (!selectedResult) return;
    setLocation({
      ...selectedResult,
      source: 'manual',
      updatedAt: new Date().toISOString(),
    });
    setResults([]);
    setSelectedResult(null);
    setQuery('');
    setError(null);
    setIsLocationModalOpen(false);
  };

  const formatDetailsLine = (item: GeocodeResult): string => {
    const parts = [
      item.district && item.district !== item.city ? item.district : '',
      item.region || '',
      item.country || '',
    ].filter(Boolean);
    const joined = parts.join(', ');
    if (item.pinCode) {
      return joined ? `${joined} · PIN ${item.pinCode}` : `PIN ${item.pinCode}`;
    }
    return joined || '—';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsLocationModalOpen(false);
        }
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#0E131B] border border-[#080808] dark:border-[#222B3A] border-t-2 border-t-sky-600 dark:border-t-sky-400 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400">
              {t('modals.locationKicker')}
            </p>
            <h2
              id="location-modal-title"
              className="text-xl font-bold text-[#080808] dark:text-white mt-1"
            >
              {t('modals.locationTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(false)}
            className="p-2 border border-[#DADADA] dark:border-[#222B3A] text-[#080808] dark:text-white hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]"
            aria-label="Close location selector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {profile.location && (
            <div className="p-3 bg-[#F3F3F3] dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t('modals.activeLocation')}
                  </div>
                  <div className="text-sm font-semibold text-[#080808] dark:text-white truncate">
                    {profile.location.name}
                    {profile.location.country ? ` · ${profile.location.country}` : ''}
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 shrink-0">
                {profile.location.source === 'geolocation'
                  ? t('modals.sourceGps')
                  : t('modals.sourceManual')}
              </span>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              <LocateFixed className="w-4 h-4 text-white" />
              {geoLoading ? t('modals.gpsLoading') : t('modals.gpsBtn')}
            </button>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
              {t('modals.gpsNote')}
            </p>
          </div>

          <div className="border-t border-[#DADADA] dark:border-[#222B3A] pt-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <label htmlFor="location-search-input" className="sr-only">
                {t('modals.locationSearchPlaceholder')}
              </label>
              <input
                id="location-search-input"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t('modals.locationSearchPlaceholder')}
                className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-[#080808] dark:text-white focus:outline-none focus:border-[#080808] dark:focus:border-white"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2.5 border border-[#080808] dark:border-white text-sm font-medium text-[#080808] dark:text-white hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] disabled:opacity-40 flex items-center gap-1.5 shrink-0"
              >
                <Search className="w-4 h-4" />
                {searching ? t('common.searching') : t('common.search')}
              </button>
            </form>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 border border-red-600 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <div className="border border-[#DADADA] dark:border-[#222B3A] divide-y divide-[#DADADA] dark:divide-[#222B3A] max-h-56 overflow-y-auto">
                {results.map((item, idx) => {
                  const isSelected =
                    selectedResult?.latitude === item.latitude &&
                    selectedResult?.longitude === item.longitude &&
                    selectedResult?.name === item.name;
                  return (
                    <button
                      key={`${item.latitude}-${item.longitude}-${idx}`}
                      type="button"
                      onClick={() => setSelectedResult(item)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-[#F3F3F3] dark:bg-[#151C28] border-l-2 border-l-sky-600 dark:border-l-sky-400'
                          : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#080808] dark:text-white truncate flex items-center gap-1.5">
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          )}
                          <span className="truncate">{item.city || item.name}</span>
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {formatDetailsLine(item)}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                        {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedResult && (
                <div className="p-3.5 bg-[#F3F3F3] dark:bg-[#151C28] border border-[#080808] dark:border-sky-500/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      {t('modals.selectedPreview')}
                    </div>
                    <div className="text-sm font-semibold text-[#080808] dark:text-white truncate mt-0.5">
                      {selectedResult.name}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                      {formatDetailsLine(selectedResult)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmSelected}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    {t('modals.confirmLocation')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
