import React from 'react';
import { AlertTriangle, MapPin, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import { formatTimestamp } from '../../utils/aqi';

export const StatusAlertBanner: React.FC = () => {
  const { t } = useTranslation();
  const {
    profile,
    airQuality,
    isShowingCachedData,
    effectiveSnapshot,
    refreshAirQuality,
    setIsLocationModalOpen,
  } = useApp();

  if (!profile.location) {
    return (
      <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 bg-[#F3F3F3] dark:bg-[#0E131B] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-bold">{t('banners.noLocationTitle')}</div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
              {t('banners.noLocationDesc')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          {t('nav.selectLocation')}
        </button>
      </div>
    );
  }

  if (airQuality.error) {
    return (
      <div className="border border-red-600 bg-red-50 dark:bg-red-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-red-800 dark:text-red-200">
              {t('banners.liveUnavailableTitle')}
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
              {isShowingCachedData && effectiveSnapshot
                ? t('banners.showingCached', {
                    time: formatTimestamp(effectiveSnapshot.fetchedAt),
                    location: effectiveSnapshot.locationName,
                  })
                : t('banners.noFabricated')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshAirQuality()}
          disabled={airQuality.loading}
          className="px-3.5 py-2 border border-red-700 dark:border-red-400 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-red-100 dark:hover:bg-red-950"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${airQuality.loading ? 'animate-spin' : ''}`} />
          {t('common.retryLiveFeed')}
        </button>
      </div>
    );
  }

  return null;
};
