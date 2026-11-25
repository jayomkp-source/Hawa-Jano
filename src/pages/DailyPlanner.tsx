import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Clock,
  CloudSun,
  Moon,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sun,
  Sunset,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusAlertBanner } from '../components/dashboard/StatusAlertBanner';
import { RoutineCard } from '../components/planner/RoutineCard';
import { useApp } from '../contexts/AppContext';
import type { RoutineTimeBlock } from '../types';
import { formatTimestamp } from '../utils/aqi';

export const DailyPlanner: React.FC = () => {
  const { t } = useTranslation();
  const {
    profile,
    activeScale,
    activeAqiValue,
    activeCategory,
    routinePlan,
    routineLoading,
    routineError,
    generateRoutine,
    completedRoutineIds,
    toggleRoutineDone,
  } = useApp();

  const [timeFilter, setTimeFilter] = useState<'all' | RoutineTimeBlock>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  const timeBlocks: Array<{
    id: 'all' | RoutineTimeBlock;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    activeClass: string;
  }> = [
    {
      id: 'all',
      label: t('planner.fullDay'),
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      activeClass: 'bg-blue-600 text-white',
    },
    {
      id: 'morning',
      label: t('planner.morning'),
      icon: Sun,
      color: 'text-amber-500 dark:text-amber-400',
      activeClass: 'bg-amber-600 text-white',
    },
    {
      id: 'afternoon',
      label: t('planner.afternoon'),
      icon: CloudSun,
      color: 'text-sky-600 dark:text-sky-400',
      activeClass: 'bg-sky-600 text-white',
    },
    {
      id: 'evening',
      label: t('planner.evening'),
      icon: Sunset,
      color: 'text-orange-600 dark:text-orange-400',
      activeClass: 'bg-orange-600 text-white',
    },
    {
      id: 'night',
      label: t('planner.night'),
      icon: Moon,
      color: 'text-indigo-600 dark:text-indigo-400',
      activeClass: 'bg-indigo-600 text-white',
    },
  ];

  const filteredItems = useMemo(() => {
    if (!routinePlan) return [];
    return routinePlan.recommendations.filter((item) => {
      if (timeFilter !== 'all' && item.timeBlock !== timeFilter) return false;
      if (difficultyFilter !== 'all' && item.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [routinePlan, timeFilter, difficultyFilter]);

  const totalCount = routinePlan?.recommendations.length ?? 0;
  const doneCount = completedRoutineIds.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('planner.kicker')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {t('planner.title')}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
            {t('planner.subtitle', {
              lifestyle: t(`onboarding.lifestyles.${profile.lifestyle}`),
              members: profile.household.familyMembers,
              budget: t(`onboarding.budgets.${profile.preferences.budget}`),
              aqi:
                activeAqiValue !== null
                  ? `${activeAqiValue} (${t(`scale.${activeScale}_SHORT`)} ${t(
                      activeCategory.shortLabelKey
                    )})`
                  : t('common.unavailable'),
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void generateRoutine()}
          disabled={routineLoading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${routineLoading ? 'animate-spin' : ''}`} />
          {routineLoading
            ? t('planner.generating')
            : routinePlan
              ? t('planner.regenerate')
              : t('planner.generateToday')}
        </button>
      </div>

      <StatusAlertBanner />

      {routineError && (
        <div
          role="alert"
          className="border border-red-600 bg-red-50 dark:bg-red-950/30 p-4 text-xs text-red-700 dark:text-red-300"
        >
          {routineError}
        </div>
      )}

      {!routinePlan && !routineLoading && (
        <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 bg-[#F3F3F3] dark:bg-[#0E131B] p-8 text-center space-y-4">
          <CalendarCheck className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold">{t('planner.emptyTitle')}</h2>
            <p className="text-xs text-neutral-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              {t('planner.emptyDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generateRoutine()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {t('planner.generateCta')}
          </button>
        </div>
      )}

      {routineLoading && (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B] p-6 space-y-3"
            >
              <div className="h-4 w-48 bg-[#F3F3F3] dark:bg-[#151C28]" />
              <div className="h-3 w-full bg-[#F3F3F3] dark:bg-[#151C28]" />
              <div className="h-3 w-2/3 bg-[#F3F3F3] dark:bg-[#151C28]" />
            </div>
          ))}
        </div>
      )}

      {routinePlan && !routineLoading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 bg-white dark:bg-[#0E131B] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500 dark:text-slate-400">
                <span>{t('planner.planFor', { location: routinePlan.locationName })}</span>
                <span>
                  {t('planner.generatedAt', { time: formatTimestamp(routinePlan.generatedAt) })}
                </span>
              </div>
              <p className="text-sm font-medium leading-relaxed">{routinePlan.aqiSummary}</p>
              <div className="pt-2 border-t border-[#DADADA] dark:border-[#222B3A] flex items-start gap-2 text-xs text-neutral-500 dark:text-slate-400">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{routinePlan.safetyNote}</span>
              </div>
            </div>

            <div className="lg:col-span-4 border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-emerald-600 dark:border-t-emerald-400 bg-[#F3F3F3] dark:bg-[#0E131B] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-neutral-500 dark:text-slate-400">
                  {t('planner.adherence')}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {doneCount} / {totalCount} ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-3 bg-white dark:bg-[#070A0F] border border-[#DADADA] dark:border-[#222B3A] mt-3">
                <div
                  className="h-full bg-emerald-600 transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-slate-400 mt-2">
                {t('planner.adherenceNote')}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              className="flex flex-wrap border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B]"
              role="tablist"
              aria-label={t('planner.title')}
            >
              {timeBlocks.map((tb) => {
                const Icon = tb.icon;
                const active = timeFilter === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTimeFilter(tb.id)}
                    className={`px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      active ? tb.activeClass : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : tb.color}`} />
                    {tb.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="routine-diff-filter" className="text-xs font-mono text-neutral-500 dark:text-slate-400">
                {t('planner.difficulty')}:
              </label>
              <select
                id="routine-diff-filter"
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-[#0E131B] border border-[#DADADA] dark:border-[#222B3A] text-xs"
              >
                <option value="all">{t('planner.allLevels')}</option>
                <option value="Easy">{t('planner.difficulties.Easy')}</option>
                <option value="Moderate">{t('planner.difficulties.Moderate')}</option>
                <option value="Challenging">{t('planner.difficulties.Challenging')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="p-6 border border-[#DADADA] dark:border-[#222B3A] text-xs text-neutral-500 text-center">
                {t('planner.noMatch')}
              </div>
            ) : (
              filteredItems.map((item) => (
                <RoutineCard
                  key={item.id}
                  item={item}
                  completed={completedRoutineIds.includes(item.id)}
                  onToggle={() => toggleRoutineDone(item.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
