import React from 'react';
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  Droplets,
  Home,
  Leaf,
  RefreshCw,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PollutantGrid } from '../components/air-quality/PollutantGrid';
import { StatusAlertBanner } from '../components/dashboard/StatusAlertBanner';
import { AqiGauge } from '../components/shared/AqiGauge';
import { useApp } from '../contexts/AppContext';
import { INDOOR_CHECKLIST_ITEMS } from '../data/indoorAirData';
import { formatTimestamp } from '../utils/aqi';

export const Overview: React.FC = () => {
  const { t } = useTranslation();
  const {
    profile,
    airQuality,
    refreshAirQuality,
    activeScale,
    activeAqiValue,
    activeDominantPollutant,
    activeCategory,
    effectiveSnapshot,
    isShowingCachedData,
    routinePlan,
    completedRoutineIds,
    completedIndoorTasks,
    committedEcoIds,
    setActiveTab,
    setIsLocationModalOpen,
  } = useApp();

  const totalRoutine = routinePlan?.recommendations.length ?? 0;
  const doneRoutine = completedRoutineIds.length;
  const totalIndoor = INDOOR_CHECKLIST_ITEMS.length;
  const doneIndoor = completedIndoorTasks.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {t('overview.kicker')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {profile.location ? profile.location.name : t('overview.welcomeTitle')}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
            {profile.location
              ? `${profile.location.country || t('overview.selectedRegion')} · ${t(`scale.${activeScale}`)}`
              : t('overview.selectPrompt')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="px-3.5 py-2 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#0E131B] hover:border-blue-600 dark:hover:border-blue-400 text-xs font-medium transition-colors"
          >
            {profile.location ? t('nav.changeLocation') : t('nav.setLocation')}
          </button>
          {profile.location && (
            <button
              type="button"
              onClick={() => void refreshAirQuality()}
              disabled={airQuality.loading}
              className="px-3.5 py-2 border border-[#080808] dark:border-cyan-500/60 dark:bg-[#0E131B] text-xs font-medium flex items-center gap-1.5 hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] transition-colors"
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

      {/* Main Hero AQI + Weather Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <section
          className="lg:col-span-8 border border-[#080808] dark:border-[#222B3A] border-t-2 bg-white dark:bg-[#0E131B] p-6 flex flex-col justify-between"
          style={{ borderTopColor: activeCategory.hex }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-slate-400">
                {t(`scale.${activeScale}`)}
              </div>
              <div className="mt-2 flex items-baseline gap-4">
                <span className="font-mono text-5xl sm:text-6xl font-bold tabular-nums tracking-tight">
                  {airQuality.loading && !effectiveSnapshot
                    ? '...'
                    : activeAqiValue !== null
                      ? activeAqiValue
                      : '—'}
                </span>
                <div>
                  <div
                    className={`text-lg font-bold flex items-center gap-2 ${activeCategory.textColorClass}`}
                  >
                    <span
                      className="w-2.5 h-2.5 inline-block"
                      style={{ backgroundColor: activeCategory.hex }}
                      aria-hidden="true"
                    />
                    {t(activeCategory.labelKey)}
                  </div>
                  {activeDominantPollutant && (
                    <div className="text-xs font-mono text-neutral-500 dark:text-slate-400 mt-0.5">
                      {t('overview.primaryDriver')}:{' '}
                      <span className="text-[#080808] dark:text-slate-200 font-semibold">
                        {activeDominantPollutant}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {effectiveSnapshot && (
              <div className="text-right text-xs font-mono text-neutral-500 dark:text-slate-400">
                <div>
                  {t('overview.updated')}: {formatTimestamp(effectiveSnapshot.measuredAt)}
                </div>
                <div className="mt-0.5">
                  {isShowingCachedData ? t('overview.cachedSnapshot') : effectiveSnapshot.source}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <AqiGauge value={activeAqiValue} scale={activeScale} />
          </div>

          <div className="mt-6 pt-4 border-t border-[#DADADA] dark:border-[#222B3A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-[#080808] dark:text-slate-200 leading-relaxed max-w-2xl">
              {t(activeCategory.explanationKey)}
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('air-quality')}
              className="px-3.5 py-2 border border-[#080808] dark:border-orange-500/60 dark:bg-[#151C28] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-[#F3F3F3] dark:hover:bg-[#1B2538] transition-colors"
            >
              {t('overview.detailedTelemetry')}
              <ArrowRight className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            </button>
          </div>
        </section>

        {/* Weather & Daily Progress Column */}
        <section className="lg:col-span-4 border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 bg-[#F3F3F3] dark:bg-[#0E131B] p-6 flex flex-col justify-between gap-5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
              {t('overview.weatherTitle')}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-3">
                <span className="w-7 h-7 border border-orange-200 dark:border-orange-800/70 bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center">
                  <Thermometer className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                </span>
                <div className="font-mono text-lg font-bold tabular-nums mt-2">
                  {effectiveSnapshot?.weather.temperature !== null &&
                  effectiveSnapshot?.weather.temperature !== undefined
                    ? `${Math.round(effectiveSnapshot.weather.temperature)}°C`
                    : '—'}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-slate-400">
                  {t('overview.temp')}
                </div>
              </div>
              <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-3">
                <span className="w-7 h-7 border border-cyan-200 dark:border-cyan-800/70 bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center">
                  <Droplets className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </span>
                <div className="font-mono text-lg font-bold tabular-nums mt-2">
                  {effectiveSnapshot?.weather.humidity !== null &&
                  effectiveSnapshot?.weather.humidity !== undefined
                    ? `${Math.round(effectiveSnapshot.weather.humidity)}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-slate-400">
                  {t('overview.humidity')}
                </div>
              </div>
              <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-3">
                <span className="w-7 h-7 border border-blue-200 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                  <Wind className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </span>
                <div className="font-mono text-lg font-bold tabular-nums mt-2">
                  {effectiveSnapshot?.weather.windSpeed !== null &&
                  effectiveSnapshot?.weather.windSpeed !== undefined
                    ? `${effectiveSnapshot.weather.windSpeed.toFixed(0)}`
                    : '—'}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-slate-400">
                  {t('overview.windUnit')}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#DADADA] dark:border-[#222B3A] pt-4 space-y-2.5">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-slate-400">
              {t('overview.dailyProgress')}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>{t('overview.aiRoutineTasks')}</span>
              <span className="font-mono font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {doneRoutine} / {totalRoutine || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>{t('overview.indoorChecklist')}</span>
              <span className="font-mono font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">
                {doneIndoor} / {totalIndoor}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>{t('overview.ecoCommitments')}</span>
              <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {t('overview.activeCount', { count: committedEcoIds.length })}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Pollutant Snapshot */}
      <section aria-labelledby="overview-pollutants-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="overview-pollutants-heading"
            className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-slate-400"
          >
            {t('overview.livePollutantsHeading')}
          </h2>
          <span className="text-xs text-neutral-500 dark:text-slate-400">
            {effectiveSnapshot ? t('overview.unitsNote') : t('overview.awaitingFeed')}
          </span>
        </div>
        <PollutantGrid pollutants={effectiveSnapshot?.pollutants ?? null} />
      </section>

      {/* Functional Quick-Launch Action Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('planner')}
          className="text-left border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 hover:border-blue-600 dark:hover:border-blue-400 bg-white dark:bg-[#0E131B] p-5 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 border border-blue-200 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </span>
            <ArrowRight className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-bold">{t('overview.cardRoutineTitle')}</div>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
              {routinePlan
                ? t('overview.cardRoutineReady', { count: routinePlan.recommendations.length })
                : t('overview.cardRoutineEmpty')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('indoor-air')}
          className="text-left border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-cyan-600 dark:border-t-cyan-400 hover:border-cyan-600 dark:hover:border-cyan-400 bg-white dark:bg-[#0E131B] p-5 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 border border-cyan-200 dark:border-cyan-800/70 bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center">
              <Home className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </span>
            <ArrowRight className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold">{t('overview.cardIndoorTitle')}</div>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
              {t('overview.cardIndoorDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('eco-alternatives')}
          className="text-left border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-emerald-600 dark:border-t-emerald-400 hover:border-emerald-600 dark:hover:border-emerald-400 bg-white dark:bg-[#0E131B] p-5 transition-colors flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <ArrowRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold">{t('overview.cardEcoTitle')}</div>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
              {t('overview.cardEcoDesc')}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assistant')}
          className="text-left border border-purple-600 dark:border-purple-500/70 border-t-2 border-t-purple-500 bg-[#080808] text-white dark:bg-[#151026] p-5 hover:opacity-95 transition-opacity flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between">
            <span className="w-8 h-8 border border-purple-500/60 bg-purple-950/80 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-300" />
            </span>
            <Activity className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="text-sm font-bold">{t('overview.cardAssistantTitle')}</div>
            <p className="text-xs text-neutral-300 dark:text-slate-300 mt-1">
              {t('overview.cardAssistantDesc')}
            </p>
          </div>
        </button>
      </section>
    </div>
  );
};
