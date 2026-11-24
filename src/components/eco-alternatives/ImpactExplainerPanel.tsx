import React from 'react';
import { ArrowRight, Info, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EcoAlternative } from '../../types';

interface ImpactExplainerPanelProps {
  selected: EcoAlternative;
  committedCount: number;
  totalWeeklyKgSaved: number;
  totalMonthlyInrSaved: number;
  totalMonthlyUsdSaved: number;
  useInr: boolean;
}

export const ImpactExplainerPanel: React.FC<ImpactExplainerPanelProps> = ({
  selected,
  committedCount,
  totalWeeklyKgSaved,
  totalMonthlyInrSaved,
  totalMonthlyUsdSaved,
  useInr,
}) => {
  const { t } = useTranslation();

  return (
    <div className="border border-[#080808] dark:border-[#222B3A] border-t-2 border-t-emerald-600 dark:border-t-emerald-400 bg-[#F3F3F3] dark:bg-[#0E131B] p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#DADADA] dark:border-[#222B3A]">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {t('eco.impactExplainer')}
          </span>
          <h3 className="text-lg font-bold mt-0.5">{selected.title}</h3>
        </div>
        <div className="text-xs font-mono text-neutral-600 dark:text-neutral-300 tabular-nums">
          {t('eco.committedSwaps')}: <strong>{committedCount}</strong> · {t('common.estimate')}{' '}
          <strong>{totalWeeklyKgSaved.toFixed(1)} kg CO₂e/wk</strong> · {t('common.estimate')}{' '}
          <strong>
            {useInr
              ? `₹${totalMonthlyInrSaved.toLocaleString()}/mo`
              : `$${totalMonthlyUsdSaved.toLocaleString()}/mo`}
          </strong>
        </div>
      </div>

      {/* Before vs After Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-stretch">
        <div className="md:col-span-5 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-4">
          <div className="text-[11px] font-mono uppercase text-neutral-500 dark:text-neutral-400">
            {t('eco.beforeBaseline')}
          </div>
          <p className="text-sm font-medium mt-1.5">{selected.originalActivity}</p>
        </div>

        <div className="md:col-span-1 flex items-center justify-center">
          <ArrowRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 rotate-90 md:rotate-0" />
        </div>

        <div className="md:col-span-5 bg-white dark:bg-[#151C28] border border-emerald-600 p-4">
          <div className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-400">
            {t('eco.afterSwap')}
          </div>
          <p className="text-sm font-medium mt-1.5">{selected.sustainableAlternative}</p>
        </div>
      </div>

      {/* Direct Impact, Personal Benefit, Community Benefit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-4">
          <div className="text-[11px] font-mono uppercase text-neutral-500 dark:text-neutral-400">
            {t('eco.directImpact')}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed">{selected.directImpact}</p>
        </div>
        <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-4">
          <div className="text-[11px] font-mono uppercase text-blue-600 dark:text-blue-400">
            {t('eco.personalBenefit')}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed">{selected.personalBenefit}</p>
        </div>
        <div className="bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-4">
          <div className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-400">
            {t('eco.communityBenefit')}
          </div>
          <p className="text-xs mt-1.5 leading-relaxed">{selected.communityBenefit}</p>
        </div>
      </div>

      {/* Explicit Separation: Personal Exposure Reduction vs Environmental Emissions Reduction */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{t('eco.personalExposureNote')}</div>
            <p className="text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
              {selected.personalExposureNote}
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{t('eco.estimateBoundary')}</div>
            <p className="text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
              {selected.emissionsAssumption} {t('eco.boundarySuffix')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
