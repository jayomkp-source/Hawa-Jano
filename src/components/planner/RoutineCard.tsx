import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RoutineRecommendation } from '../../types';

interface RoutineCardProps {
  item: RoutineRecommendation;
  completed: boolean;
  onToggle: () => void;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({ item, completed, onToggle }) => {
  const { t } = useTranslation();

  const diffColor =
    item.difficulty === 'Easy'
      ? 'text-green-600 dark:text-green-400'
      : item.difficulty === 'Moderate'
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-orange-600 dark:text-orange-400';

  const blockLabel =
    item.timeBlock === 'morning' ||
    item.timeBlock === 'afternoon' ||
    item.timeBlock === 'evening' ||
    item.timeBlock === 'night'
      ? t(`planner.${item.timeBlock}`)
      : item.timeBlock;

  const blockAccent =
    item.timeBlock === 'morning'
      ? 'text-amber-600 dark:text-amber-400'
      : item.timeBlock === 'afternoon'
        ? 'text-orange-600 dark:text-orange-400'
        : item.timeBlock === 'evening'
          ? 'text-cyan-600 dark:text-cyan-400'
          : 'text-indigo-600 dark:text-indigo-400';

  return (
    <article
      className={`border p-5 transition-colors ${
        completed
          ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
          : 'border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B]'
      }`}
    >
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#DADADA] dark:border-[#222B3A]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
            <span className={`uppercase font-semibold ${blockAccent}`}>{blockLabel}</span>
            <span aria-hidden="true">·</span>
            <span className={diffColor}>
              {item.difficulty === 'Easy' ||
              item.difficulty === 'Moderate' ||
              item.difficulty === 'Challenging'
                ? t(`planner.difficulties.${item.difficulty}`)
                : item.difficulty}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('planner.cost')}: {item.cost}
            </span>
          </div>
          <h4 className="text-base font-bold mt-1.5 text-[#080808] dark:text-white">
            {item.whatToDo}
          </h4>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={`px-3 py-1.5 border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
            completed
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'border-[#DADADA] dark:border-[#222B3A] hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
          }`}
          aria-pressed={completed}
        >
          {completed ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          {completed ? t('planner.completed') : t('planner.markDone')}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-xs">
        <div>
          <dt className="font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t('planner.whyItMatters')}
          </dt>
          <dd className="mt-1 text-neutral-700 dark:text-neutral-200 leading-relaxed">
            {item.whyItMatters}
          </dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t('planner.howToDoIt')}
          </dt>
          <dd className="mt-1 text-neutral-700 dark:text-neutral-200 leading-relaxed">
            {item.howToDoIt}
          </dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t('planner.estimatedImpact')}
          </dt>
          <dd className="mt-1 font-medium text-[#080808] dark:text-white leading-relaxed">
            {item.estimatedImpact}
          </dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {t('planner.whoBenefits')}
          </dt>
          <dd className="mt-1 text-neutral-700 dark:text-neutral-200 leading-relaxed">
            {item.whoBenefits}
          </dd>
        </div>
      </dl>
    </article>
  );
};
