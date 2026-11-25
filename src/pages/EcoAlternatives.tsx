import React, { useMemo, useState } from 'react';
import { Check, Home, Layers, Leaf, Plus, Train } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ImpactExplainerPanel } from '../components/eco-alternatives/ImpactExplainerPanel';
import { useApp } from '../contexts/AppContext';
import { getEcoAlternatives } from '../data/ecoAndCommunityData';
import { calculateEcoImpactSummary, formatEcoMoneyEstimate } from '../utils/ecoImpact';

export const EcoAlternatives: React.FC = () => {
  const { t } = useTranslation();
  const {
    language,
    profile,
    activeCategory,
    committedEcoIds,
    toggleCommitEco,
  } = useApp();

  const ecoAlternatives = useMemo(() => getEcoAlternatives(language), [language]);

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'transport' | 'household' | 'lifestyle'>('all');
  const [selectedId, setSelectedId] = useState<string>(ecoAlternatives[0].id);

  const useInr = !profile.location || profile.location.countryCode.toUpperCase() === 'IN';

  const visibleItems = useMemo(() => {
    return ecoAlternatives.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [ecoAlternatives, categoryFilter]);

  const selectedItem =
    ecoAlternatives.find((item) => item.id === selectedId) || ecoAlternatives[0];

  const totals = useMemo(
    () => calculateEcoImpactSummary(ecoAlternatives, committedEcoIds),
    [ecoAlternatives, committedEcoIds]
  );

  const tabs = [
    {
      id: 'all',
      label: t('common.all'),
      icon: Layers,
      color: 'text-emerald-600 dark:text-emerald-400',
      activeClass: 'bg-emerald-600 text-white',
    },
    {
      id: 'transport',
      label: t('eco.transport'),
      icon: Train,
      color: 'text-blue-600 dark:text-blue-400',
      activeClass: 'bg-blue-600 text-white',
    },
    {
      id: 'household',
      label: t('eco.household'),
      icon: Home,
      color: 'text-cyan-600 dark:text-cyan-400',
      activeClass: 'bg-cyan-600 text-white',
    },
    {
      id: 'lifestyle',
      label: t('eco.lifestyle'),
      icon: Leaf,
      color: 'text-amber-600 dark:text-amber-400',
      activeClass: 'bg-amber-600 text-white',
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {t('eco.kicker')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">{t('eco.title')}</h1>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">{t('eco.subtitle')}</p>
        </div>

        <div
          className="flex flex-wrap border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B]"
          role="tablist"
          aria-label={t('eco.title')}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  active ? tab.activeClass : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : tab.color}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Core Differentiating Feature: Impact Explainer */}
      <ImpactExplainerPanel
        selected={selectedItem}
        committedCount={committedEcoIds.length}
        totalWeeklyKgSaved={totals.weeklyKg}
        totalMonthlyInrSaved={totals.monthlyInr}
        totalMonthlyUsdSaved={totals.monthlyUsd}
        useInr={useInr}
      />

      {/* Alternatives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleItems.map((item) => {
          const isCommitted = committedEcoIds.includes(item.id);
          const isSelected = selectedItem.id === item.id;
          const moneyDisplay = formatEcoMoneyEstimate(item, useInr, t('common.estimate'));

          return (
            <article
              key={item.id}
              className={`border border-t-2 p-5 flex flex-col justify-between transition-colors ${
                isSelected
                  ? 'border-[#080808] dark:border-emerald-400 border-t-emerald-600 dark:border-t-emerald-400 bg-white dark:bg-[#0E131B]'
                  : 'border-[#DADADA] dark:border-[#222B3A] border-t-blue-600/50 dark:border-t-slate-700 bg-white dark:bg-[#0E131B]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-neutral-500 dark:text-slate-400">
                  <span className="uppercase">
                    {t(`eco.${item.category}`)} · {t('planner.difficulty')}:{' '}
                    {t(`planner.difficulties.${item.difficulty}`)}
                  </span>
                  {item.outdoorAirSensitive && !activeCategory.exerciseSafe && (
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                      {t('eco.pauseOutdoor')}
                    </span>
                  )}
                </div>

                <h2 className="text-base font-bold">{item.title}</h2>

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#F3F3F3] dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-neutral-500 dark:text-slate-400">
                      {t('eco.original')}
                    </div>
                    <div className="mt-0.5">{item.originalActivity}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-emerald-700 dark:text-emerald-400">
                      {t('eco.alternative')}
                    </div>
                    <div className="mt-0.5 font-medium">{item.sustainableAlternative}</div>
                  </div>
                </div>

                <p className="text-xs text-neutral-600 dark:text-slate-300 leading-relaxed">
                  {item.environmentalBenefit}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#DADADA] dark:border-[#222B3A] text-xs font-mono">
                  <div>
                    <span className="text-neutral-500 dark:text-slate-400 block text-[10px] uppercase">
                      {t('eco.estEmissions')}
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      -{item.estimatedEmissionsDeltaKgPerWeek.toFixed(1)} kg CO₂e/wk ({t('common.estimate')})
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-slate-400 block text-[10px] uppercase">
                      {t('eco.estMoney')}
                    </span>
                    <span className="font-bold tabular-nums">{moneyDisplay}</span>
                  </div>
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-slate-400">
                  {item.moneyAssumption}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(item.id)}
                  className={`px-3 py-1.5 border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                      : 'border-[#DADADA] dark:border-[#222B3A] hover:border-[#080808] dark:hover:border-emerald-400'
                  }`}
                >
                  <Leaf className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {isSelected ? t('eco.inspecting') : t('eco.inspect')}
                </button>

                <button
                  type="button"
                  aria-pressed={isCommitted}
                  onClick={() => toggleCommitEco(item.id)}
                  className={`px-3.5 py-1.5 border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isCommitted
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-[#080808] text-white dark:bg-blue-600 dark:hover:bg-blue-700 border-[#080808] dark:border-blue-600'
                  }`}
                >
                  {isCommitted ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {t('eco.committed')}
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      {t('eco.commitAction')}
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
