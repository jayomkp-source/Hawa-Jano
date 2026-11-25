import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Building2,
  Check,
  CheckSquare,
  GraduationCap,
  Layers,
  Megaphone,
  Share2,
  Square,
  Train,
  Trees,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { getCommunityInitiatives } from '../data/ecoAndCommunityData';
import type { CommunityInitiative } from '../types';

const FILTER_TABS = [
  { id: 'all', icon: Layers, color: 'text-amber-600 dark:text-amber-400', active: 'bg-amber-600 text-white' },
  { id: 'school', icon: GraduationCap, color: 'text-blue-600 dark:text-blue-400', active: 'bg-blue-600 text-white' },
  { id: 'neighborhood', icon: Building2, color: 'text-orange-600 dark:text-orange-400', active: 'bg-orange-600 text-white' },
  { id: 'green-space', icon: Trees, color: 'text-emerald-600 dark:text-emerald-400', active: 'bg-emerald-600 text-white' },
  { id: 'transit', icon: Train, color: 'text-cyan-600 dark:text-cyan-400', active: 'bg-cyan-600 text-white' },
  { id: 'awareness', icon: Megaphone, color: 'text-purple-600 dark:text-purple-400', active: 'bg-purple-600 text-white' },
  { id: 'challenge', icon: Award, color: 'text-rose-600 dark:text-rose-400', active: 'bg-rose-600 text-white' },
] as const;

export const Community: React.FC = () => {
  const { t } = useTranslation();
  const {
    language,
    joinedCommunityIds,
    toggleJoinCommunity,
    completedCommunitySteps,
    toggleCommunityStep,
  } = useApp();

  const initiatives = useMemo(() => getCommunityInitiatives(language), [language]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const visible = useMemo(() => {
    if (categoryFilter === 'all') return initiatives;
    return initiatives.filter((c) => c.category === categoryFilter);
  }, [initiatives, categoryFilter]);

  const totalStepsAvailable = initiatives.reduce((sum, c) => sum + c.steps.length, 0);

  const handleShare = async (initiative: CommunityInitiative) => {
    try {
      await navigator.clipboard.writeText(`${initiative.title}\n\n${initiative.shareMessage}`);
      setCopiedId(initiative.id);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedId(null);
        copyTimerRef.current = null;
      }, 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {t('community.kicker')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {t('community.title')}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
            {t('community.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#0E131B] px-3.5 py-2">
          <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>
            {t('community.joined')}:{' '}
            <strong className="text-amber-600 dark:text-amber-400">{joinedCommunityIds.length}</strong>{' '}
            · {t('community.stepsDone')}:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {completedCommunitySteps.length}
            </strong>{' '}
            / {totalStepsAvailable}
          </span>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div
        className="flex flex-wrap border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B] w-fit"
        role="tablist"
        aria-label={t('community.title')}
      >
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                active ? tab.active : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : tab.color}`} aria-hidden="true" />
              {t(`community.filters.${tab.id}`)}
            </button>
          );
        })}
      </div>

      {/* Personal / Group Contribution Summary */}
      <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-amber-500 bg-[#F3F3F3] dark:bg-[#0E131B] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase text-neutral-500 dark:text-slate-400">
            {t('community.logTitle')}
          </div>
          <p className="text-xs text-neutral-700 dark:text-slate-300 mt-1">
            {t('community.logDesc')}
          </p>
        </div>
        <div className="font-mono text-sm font-bold tabular-nums shrink-0 text-amber-600 dark:text-amber-400">
          {t('community.progressLabel', {
            pct: Math.round((completedCommunitySteps.length / totalStepsAvailable) * 100),
          })}
        </div>
      </div>

      {/* Initiatives Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((item) => {
          const joined = joinedCommunityIds.includes(item.id);
          const stepsDone = item.steps.filter((_, idx) =>
            completedCommunitySteps.includes(`${item.id}:${idx}`)
          ).length;

          return (
            <article
              key={item.id}
              className={`border border-t-2 p-5 flex flex-col justify-between transition-colors ${
                joined
                  ? 'border-emerald-600 dark:border-emerald-400 border-t-emerald-500 bg-white dark:bg-[#0E131B]'
                  : 'border-[#DADADA] dark:border-[#222B3A] border-t-amber-500/70 bg-white dark:bg-[#0E131B]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-neutral-500 dark:text-slate-400">
                  <span className="uppercase text-amber-600 dark:text-amber-400 font-semibold">
                    {t(`community.filters.${item.category}`)}
                  </span>
                  <span>
                    {item.estimatedTime} ·{' '}
                    {t('community.stepsCount', { done: stepsDone, total: item.steps.length })}
                  </span>
                </div>

                <h2 className="text-base font-bold mt-1.5">{item.title}</h2>
                <p className="text-xs text-neutral-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  {item.summary}
                </p>
                <div className="text-[11px] text-neutral-500 dark:text-slate-400 mt-2">
                  {t('community.participants')}: {item.targetParticipants}
                </div>

                <div className="mt-4 border-t border-[#DADADA] dark:border-[#222B3A] pt-3 space-y-2">
                  {item.steps.map((stepText, idx) => {
                    const stepKey = `${item.id}:${idx}`;
                    const checked = completedCommunitySteps.includes(stepKey);
                    return (
                      <button
                        key={stepKey}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleCommunityStep(stepKey)}
                        className="w-full text-left flex items-start gap-2.5 text-xs hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] p-1.5 transition-colors"
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                        )}
                        <span className={checked ? 'line-through opacity-70' : ''}>{stepText}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void handleShare(item)}
                  className="px-3 py-1.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#151C28] hover:border-[#080808] dark:hover:border-amber-400 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t('community.copiedShare')}
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      {t('community.copyShare')}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  aria-pressed={joined}
                  onClick={() => toggleJoinCommunity(item.id)}
                  className={`px-3.5 py-1.5 border text-xs font-semibold transition-colors ${
                    joined
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-[#080808] text-white dark:bg-amber-600 dark:hover:bg-amber-700 border-[#080808] dark:border-amber-600'
                  }`}
                >
                  {joined ? t('community.joinedInitiative') : t('community.joinChallenge')}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
