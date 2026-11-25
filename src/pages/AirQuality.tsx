import React from 'react';
import {
  AlertCircle,
  Compass,
  Droplets,
  RefreshCw,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AirQualityCharts } from '../components/air-quality/AirQualityCharts';
import { HistoricalTrendsChart } from '../components/air-quality/HistoricalTrendsChart';
import { PollutantGrid } from '../components/air-quality/PollutantGrid';
import { StatusAlertBanner } from '../components/dashboard/StatusAlertBanner';
import { AqiGauge } from '../components/shared/AqiGauge';
import { useApp } from '../contexts/AppContext';
import { analyzeAtmosphericDispersion, formatWindDirection } from '../services/weatherService';
import type { AqiScale } from '../types';
import {
  formatTimestamp,
  getAqiCategory,
  inferLikelyContributors,
} from '../utils/aqi';

export const AirQuality: React.FC = () => {
  const { t } = useTranslation();
  const {
    theme,
    language,
    profile,
    updateProfile,
    airQuality,
    refreshAirQuality,
    activeScale,
    activeAqiValue,
    activeDominantPollutant,
    activeCategory,
    effectiveSnapshot,
    isShowingCachedData,
  } = useApp();

  const dispersion = analyzeAtmosphericDispersion(effectiveSnapshot?.weather ?? null, language);
  const contributors = effectiveSnapshot
    ? inferLikelyContributors(effectiveSnapshot.pollutants, language)
    : [];

  const prev24Avg = effectiveSnapshot
    ? activeScale === 'IN_NAQI'
      ? effectiveSnapshot.previous24hAvgAqi.IN_NAQI
      : effectiveSnapshot.previous24hAvgAqi.US_EPA
    : null;

  const deltaFrom24h =
    activeAqiValue !== null && prev24Avg !== null ? activeAqiValue - prev24Avg : null;

  const altScale: AqiScale = activeScale === 'IN_NAQI' ? 'US_EPA' : 'IN_NAQI';
  const altAqiValue = effectiveSnapshot
    ? altScale === 'IN_NAQI'
      ? effectiveSnapshot.scales.IN_NAQI.value
      : effectiveSnapshot.scales.US_EPA.value
    : null;
  const altCategory = getAqiCategory(altAqiValue, altScale);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-orange-600 dark:text-orange-400">
            {t('airQuality.kicker')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {profile.location ? profile.location.name : t('airQuality.titleFallback')}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
            {t('airQuality.activeScaleLabel')}:{' '}
            <strong className="text-[#080808] dark:text-white">{t(`scale.${activeScale}`)}</strong>
            {effectiveSnapshot?.stationName
              ? ` · ${t('airQuality.stationLabel')}: ${effectiveSnapshot.stationName}`
              : effectiveSnapshot
                ? ` · ${t('modals.stationUnavailable')}`
                : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex border border-[#DADADA] dark:border-[#222B3A]"
            role="group"
            aria-label="Select AQI scale"
          >
            <button
              type="button"
              aria-pressed={activeScale === 'IN_NAQI'}
              onClick={() => updateProfile({ preferredScale: 'IN_NAQI' })}
              className={`px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                activeScale === 'IN_NAQI'
                  ? 'bg-orange-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              {t('scale.inShortBtn')}
            </button>
            <button
              type="button"
              aria-pressed={activeScale === 'US_EPA'}
              onClick={() => updateProfile({ preferredScale: 'US_EPA' })}
              className={`px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                activeScale === 'US_EPA'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              {t('scale.usShortBtn')}
            </button>
          </div>

          {profile.location && (
            <button
              type="button"
              onClick={() => void refreshAirQuality()}
              disabled={airQuality.loading}
              className="px-3.5 py-1.5 border border-[#080808] dark:border-cyan-500/60 dark:bg-[#0E131B] text-xs font-medium flex items-center gap-1.5 hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 ${
                  airQuality.loading ? 'animate-spin' : ''
                }`}
              />
              {t('common.refresh')}
            </button>
          )}
        </div>
      </div>

      <StatusAlertBanner />

      {/* Primary AQI & Health Implications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div
          className="lg:col-span-7 border border-[#080808] dark:border-[#222B3A] border-t-2 bg-white dark:bg-[#0E131B] p-6 flex flex-col justify-between space-y-5"
          style={{ borderTopColor: activeCategory.hex }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-slate-400">
                {t(`scale.${activeScale}`)}
              </div>
              <div className="mt-2 flex items-baseline gap-4">
                <span className="font-mono text-6xl font-bold tabular-nums">
                  {activeAqiValue !== null ? activeAqiValue : '—'}
                </span>
                <div>
                  <div className={`text-xl font-bold ${activeCategory.textColorClass}`}>
                    {t(activeCategory.labelKey)}
                  </div>
                  <div className="text-xs font-mono text-neutral-500 dark:text-slate-400 mt-0.5">
                    {t('airQuality.band')}: {activeCategory.rangeText}
                    {activeDominantPollutant
                      ? ` · ${t('airQuality.dominant')}: ${activeDominantPollutant}`
                      : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-neutral-500 dark:text-slate-400 space-y-1">
              {effectiveSnapshot && (
                <>
                  <div>
                    {t('airQuality.measured')}: {formatTimestamp(effectiveSnapshot.measuredAt)}
                  </div>
                  <div>
                    {t('airQuality.source')}: {effectiveSnapshot.source}
                  </div>
                  {isShowingCachedData && (
                    <div className="text-orange-600 dark:text-orange-400 font-semibold">
                      {t('airQuality.cachedWarning')}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <AqiGauge value={activeAqiValue} scale={activeScale} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[#DADADA] dark:border-[#222B3A]">
            <div>
              <div className="text-xs font-mono uppercase text-neutral-500 dark:text-slate-400">
                {t('airQuality.healthImplications')}
              </div>
              <p className="text-sm mt-1 leading-relaxed">{t(activeCategory.explanationKey)}</p>
            </div>
            <div>
              <div className="text-xs font-mono uppercase text-neutral-500 dark:text-slate-400">
                {t('airQuality.sensitiveGuidance')}
              </div>
              <p className="text-sm mt-1 leading-relaxed">
                {t(activeCategory.sensitiveGroupAdviceKey)}
              </p>
            </div>
          </div>
        </div>

        {/* Comparison, Reference Scale & Weather Column */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div className="border border-[#DADADA] dark:border-[#222B3A] bg-[#F3F3F3] dark:bg-[#0E131B] p-5 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-slate-400">
              {t('airQuality.comparisonHeading')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-3.5">
                <div className="text-[11px] font-mono text-neutral-500 dark:text-slate-400">
                  {t('airQuality.past24Avg')}
                </div>
                <div className="font-mono text-xl font-bold tabular-nums mt-1">
                  {prev24Avg !== null ? prev24Avg : '—'}
                </div>
                <div className="text-[11px] font-mono mt-1 text-neutral-500 dark:text-slate-400">
                  {deltaFrom24h !== null
                    ? t('airQuality.vs24Avg', {
                        delta: `${deltaFrom24h > 0 ? '+' : ''}${deltaFrom24h}`,
                      })
                    : t('airQuality.noBaseline')}
                </div>
              </div>
              <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-3.5">
                <div className="text-[11px] font-mono text-neutral-500 dark:text-slate-400">
                  {t(`scale.${altScale}_SHORT`)}
                </div>
                <div className="font-mono text-xl font-bold tabular-nums mt-1">
                  {altAqiValue !== null ? altAqiValue : '—'}
                </div>
                <div className={`text-[11px] font-medium mt-1 ${altCategory.textColorClass}`}>
                  {t(altCategory.labelKey)}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 bg-white dark:bg-[#0E131B] p-5 space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
                {t('airQuality.weatherDispersion')}
              </span>
              <span className="text-xs text-neutral-500 dark:text-slate-400">
                {effectiveSnapshot?.weather.weatherLabel || '—'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#151C28]">
                <Thermometer className="w-4 h-4 text-orange-500 dark:text-orange-400 mx-auto" />
                <div className="font-mono text-sm font-bold tabular-nums mt-1">
                  {effectiveSnapshot?.weather.temperature !== null &&
                  effectiveSnapshot?.weather.temperature !== undefined
                    ? `${effectiveSnapshot.weather.temperature.toFixed(1)}°`
                    : '—'}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-slate-400">°C</div>
              </div>
              <div className="p-2.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#151C28]">
                <Droplets className="w-4 h-4 text-cyan-500 dark:text-cyan-400 mx-auto" />
                <div className="font-mono text-sm font-bold tabular-nums mt-1">
                  {effectiveSnapshot?.weather.humidity !== null &&
                  effectiveSnapshot?.weather.humidity !== undefined
                    ? `${Math.round(effectiveSnapshot.weather.humidity)}%`
                    : '—'}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-slate-400">RH</div>
              </div>
              <div className="p-2.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#151C28]">
                <Wind className="w-4 h-4 text-sky-500 dark:text-sky-400 mx-auto" />
                <div className="font-mono text-sm font-bold tabular-nums mt-1">
                  {effectiveSnapshot?.weather.windSpeed !== null &&
                  effectiveSnapshot?.weather.windSpeed !== undefined
                    ? `${effectiveSnapshot.weather.windSpeed.toFixed(1)}`
                    : '—'}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-slate-400">km/h</div>
              </div>
              <div className="p-2.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#151C28]">
                <Compass className="w-4 h-4 text-indigo-500 dark:text-indigo-400 mx-auto" />
                <div className="font-mono text-xs font-bold tabular-nums mt-1 truncate">
                  {formatWindDirection(effectiveSnapshot?.weather.windDirection ?? null).split(' ')[0]}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-slate-400">Dir</div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#DADADA] dark:border-[#222B3A]">
              <div className="text-xs font-semibold">{dispersion.label}</div>
              <p className="text-xs text-neutral-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {dispersion.summary}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day / 30-Day Historical Pollutant Trends (PM2.5 & NO2 Focus) */}
      <HistoricalTrendsChart />

      {/* Pollutants Breakdown */}
      <section>
        <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-slate-400 mb-3">
          {t('airQuality.pollutantBreakdown')}
        </h2>
        <PollutantGrid pollutants={effectiveSnapshot?.pollutants ?? null} />
      </section>

      {/* Main Contributors Analysis */}
      {effectiveSnapshot && (
        <section className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-amber-500 bg-white dark:bg-[#0E131B] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-bold">{t('airQuality.contributorsTitle')}</h2>
          </div>
          <ul className="space-y-2 text-xs text-neutral-700 dark:text-slate-300">
            {contributors.map((c, idx) => (
              <li key={idx} className="leading-relaxed">
                • {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 48h Historical & Forecast Chart */}
      <AirQualityCharts
        hourly={effectiveSnapshot?.hourly ?? []}
        scale={activeScale}
        isDark={theme === 'dark'}
      />
    </div>
  );
};
