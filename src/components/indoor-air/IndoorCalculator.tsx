import React, { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { calculateIndoorRecommendation } from '../../data/indoorAirData';
import type { BudgetPreference, SupportedLanguage } from '../../types';

interface IndoorCalculatorProps {
  defaultBudget: BudgetPreference;
  outdoorAqi: number | null;
  ventilationSafe: boolean;
}

export const IndoorCalculator: React.FC<IndoorCalculatorProps> = ({
  defaultBudget,
  outdoorAqi,
  ventilationSafe,
}) => {
  const { t, i18n } = useTranslation();
  const language: SupportedLanguage = i18n.language === 'hi' ? 'hi' : 'en';
  const [roomSizeSqFt, setRoomSizeSqFt] = useState<number>(180);
  const [occupants, setOccupants] = useState<number>(2);
  const [filtrationSetup, setFiltrationSetup] = useState<
    'none' | 'basic-fan' | 'hepa-single' | 'hepa-high-cadr'
  >('none');
  const [budget, setBudget] = useState<BudgetPreference>(defaultBudget);

  const result = useMemo(
    () =>
      calculateIndoorRecommendation(
        {
          roomSizeSqFt,
          occupants,
          filtrationSetup,
          budget,
          outdoorAqi,
          ventilationSafe,
        },
        language
      ),
    [roomSizeSqFt, occupants, filtrationSetup, budget, outdoorAqi, ventilationSafe, language]
  );

  return (
    <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-cyan-600 dark:border-t-cyan-400 bg-white dark:bg-[#0E131B] p-6">
      <div className="flex items-center gap-3 pb-4 border-b border-[#DADADA] dark:border-[#222B3A]">
        <div className="w-8 h-8 bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center shrink-0">
          <Calculator className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base font-bold">{t('indoor.calcTitle')}</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('indoor.calcSub')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        <div className="lg:col-span-5 space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="calc-room-size" className="font-mono uppercase text-neutral-600 dark:text-slate-300">
                {t('indoor.roomSize')}
              </label>
              <span className="font-mono font-bold tabular-nums">
                {roomSizeSqFt} {t('indoor.sqFt')}
              </span>
            </div>
            <input
              id="calc-room-size"
              type="range"
              min={80}
              max={600}
              step={10}
              value={roomSizeSqFt}
              onChange={(e) => setRoomSizeSqFt(Number(e.target.value))}
              className="w-full accent-cyan-600 dark:accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="calc-occupants" className="font-mono uppercase text-neutral-600 dark:text-slate-300">
                {t('indoor.occupants')}
              </label>
              <span className="font-mono font-bold tabular-nums">
                {occupants} {t('indoor.people')}
              </span>
            </div>
            <input
              id="calc-occupants"
              type="range"
              min={1}
              max={8}
              step={1}
              value={occupants}
              onChange={(e) => setOccupants(Number(e.target.value))}
              className="w-full accent-cyan-600 dark:accent-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="calc-filtration"
              className="block text-xs font-mono uppercase text-neutral-600 dark:text-slate-300 mb-1.5"
            >
              {t('indoor.filtrationSetup')}
            </label>
            <select
              id="calc-filtration"
              value={filtrationSetup}
              onChange={(e) =>
                setFiltrationSetup(
                  e.target.value as 'none' | 'basic-fan' | 'hepa-single' | 'hepa-high-cadr'
                )
              }
              className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
            >
              <option value="none">{t('indoor.filtrationOptions.none')}</option>
              <option value="basic-fan">{t('indoor.filtrationOptions.basic-fan')}</option>
              <option value="hepa-single">{t('indoor.filtrationOptions.hepa-single')}</option>
              <option value="hepa-high-cadr">{t('indoor.filtrationOptions.hepa-high-cadr')}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="calc-budget"
              className="block text-xs font-mono uppercase text-neutral-600 dark:text-slate-300 mb-1.5"
            >
              {t('indoor.availableBudget')}
            </label>
            <select
              id="calc-budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value as BudgetPreference)}
              className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
            >
              <option value="zero-low">{t('onboarding.budgets.zero-low')}</option>
              <option value="moderate">{t('onboarding.budgets.moderate')}</option>
              <option value="flexible">{t('onboarding.budgets.flexible')}</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#F3F3F3] dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3 pb-4 border-b border-[#DADADA] dark:border-[#222B3A]">
            <div>
              <div className="text-[11px] font-mono uppercase text-neutral-500 dark:text-neutral-400">
                {t('indoor.targetCadr')}
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1 text-cyan-700 dark:text-cyan-400">
                {result.recommendedCadrM3h} <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">m³/h</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-neutral-500 dark:text-neutral-400">
                {t('indoor.equivalent')}
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1">
                {result.recommendedCadrCfm} <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">CFM</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-neutral-500 dark:text-neutral-400">
                {t('indoor.airChanges')}
              </div>
              <div className="text-xl font-mono font-bold tabular-nums mt-1">
                {result.targetAch}× <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">/ hr</span>
              </div>
            </div>
          </div>

          {result.inputWarning && (
            <div
              role="status"
              className="border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            >
              {result.inputWarning}
            </div>
          )}

          <div>
            <div className="text-xs font-mono uppercase text-cyan-700 dark:text-cyan-400">
              {t('indoor.ventDirective')}
            </div>
            <p className="text-sm mt-1 leading-relaxed">{result.ventilationDirective}</p>
          </div>

          <div>
            <div className="text-xs font-mono uppercase text-neutral-500 dark:text-neutral-400">
              {t('indoor.recommendedSetup')}
            </div>
            <p className="text-sm mt-1 leading-relaxed">{result.priorityStrategy}</p>
          </div>

          <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 border-t border-[#DADADA] dark:border-[#222B3A] pt-3">
            {result.actionSteps.map((step, i) => (
              <li key={i}>• {step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
