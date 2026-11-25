import React, { useState } from 'react';
import {
  CheckSquare,
  Flame,
  Home,
  Info,
  Moon,
  ShieldCheck,
  Square,
  Wind,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IndoorCalculator } from '../components/indoor-air/IndoorCalculator';
import { PurifierFilterTrackerCard } from '../components/indoor-air/PurifierFilterTrackerCard';
import { useApp } from '../contexts/AppContext';
import { getIndoorChecklistItems } from '../data/indoorAirData';

export const IndoorAir: React.FC = () => {
  const { t } = useTranslation();
  const {
    language,
    profile,
    activeAqiValue,
    activeCategory,
    completedIndoorTasks,
    toggleIndoorTask,
  } = useApp();

  const [roomTab, setRoomTab] = useState<'living-room' | 'kitchen' | 'bedroom'>('living-room');

  const checklistItems = getIndoorChecklistItems(language);
  const roomItems = checklistItems.filter((item) => item.room === roomTab);
  const completedCount = completedIndoorTasks.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DADADA] dark:border-[#222B3A] pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            {t('indoor.kicker')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {t('indoor.title')}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
            {t('indoor.subtitle')}
          </p>
        </div>
        <div className="text-xs font-mono border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#0E131B] px-3 py-2">
          {t('indoor.completedActions')}:{' '}
          <strong className="text-cyan-600 dark:text-cyan-400">{completedCount}</strong> /{' '}
          {checklistItems.length}
        </div>
      </div>

      {/* Scientific Honesty Banner */}
      <div className="border border-cyan-600 dark:border-cyan-500/60 bg-[#F3F3F3] dark:bg-[#0E131B] p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <strong>{t('indoor.scopeTitle')}</strong> {t('indoor.scopeBody')}
        </div>
      </div>

      {/* Live Ventilation Window Advisor */}
      <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-cyan-600 dark:border-t-cyan-400 bg-white dark:bg-[#0E131B] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 border border-cyan-200 dark:border-cyan-800/70 bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center shrink-0 mt-0.5">
            <Wind className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </span>
          <div>
            <div className="text-xs font-mono uppercase text-neutral-500 dark:text-slate-400">
              {t('indoor.ventTitle')}
            </div>
            <div className="text-sm font-bold mt-0.5">
              {activeAqiValue === null
                ? t('indoor.ventUnavailable')
                : activeCategory.ventilationRecommended
                  ? t('indoor.ventSafeTitle', {
                      aqi: activeAqiValue,
                      label: t(activeCategory.labelKey),
                    })
                  : t('indoor.ventClosedTitle', {
                      aqi: activeAqiValue,
                      label: t(activeCategory.labelKey),
                    })}
            </div>
            <p className="text-xs text-neutral-600 dark:text-slate-300 mt-1">
              {activeCategory.ventilationRecommended
                ? t('indoor.ventSafeDesc')
                : t('indoor.ventClosedDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Indoor Air Improvement Calculator */}
      <IndoorCalculator
        defaultBudget={profile.preferences.budget}
        outdoorAqi={activeAqiValue}
        ventilationSafe={activeCategory.ventilationRecommended}
      />

      {/* Room-by-Room Checklists */}
      <section className="border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DADADA] dark:border-[#222B3A]">
          <div>
            <h2 className="text-base font-bold">{t('indoor.checklistTitle')}</h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
              {t('indoor.checklistSub')}
            </p>
          </div>

          <div
            className="flex border border-[#DADADA] dark:border-[#222B3A]"
            role="tablist"
            aria-label={t('indoor.checklistTitle')}
          >
            {[
              {
                id: 'living-room',
                label: t('indoor.livingRoom'),
                icon: Home,
                color: 'text-cyan-600 dark:text-cyan-400',
                activeClass: 'bg-cyan-600 text-white',
              },
              {
                id: 'kitchen',
                label: t('indoor.kitchenSafety'),
                icon: Flame,
                color: 'text-amber-600 dark:text-amber-400',
                activeClass: 'bg-amber-600 text-white',
              },
              {
                id: 'bedroom',
                label: t('indoor.bedroom'),
                icon: Moon,
                color: 'text-indigo-600 dark:text-indigo-400',
                activeClass: 'bg-indigo-600 text-white',
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = roomTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRoomTab(tab.id as 'living-room' | 'kitchen' | 'bedroom')}
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

        <div className="mt-4 divide-y divide-[#DADADA] dark:divide-[#222B3A]">
          {roomItems.map((item) => {
            const done = completedIndoorTasks.includes(item.id);
            return (
              <div key={item.id} className="py-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                    <span>{t(`indoor.priorities.${item.priority}`)}</span>
                  </div>
                  <h3 className={`text-sm font-semibold ${done ? 'line-through opacity-70' : ''}`}>
                    {item.title}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                    {item.detail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleIndoorTask(item.id)}
                  className={`px-3 py-1.5 border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors ${
                    done
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-[#080808] dark:border-[#222B3A] dark:bg-[#151C28] hover:bg-[#F3F3F3] dark:hover:border-cyan-400'
                  }`}
                  aria-pressed={done}
                >
                  {done ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {done ? t('common.done') : t('common.select')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Buying Guidance & Filter Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-emerald-600 dark:border-t-emerald-400 bg-[#F3F3F3] dark:bg-[#0E131B] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-bold">{t('indoor.buyingTitle')}</h3>
          </div>
          <ul className="space-y-2.5 text-xs text-neutral-700 dark:text-slate-300 leading-relaxed">
            <li>
              <strong>{t('indoor.buyingGuide.item1Title')}</strong>{' '}
              {t('indoor.buyingGuide.item1Body')}
            </li>
            <li>
              <strong>{t('indoor.buyingGuide.item2Title')}</strong>{' '}
              {t('indoor.buyingGuide.item2Body')}
            </li>
            <li>
              <strong>{t('indoor.buyingGuide.item3Title')}</strong>{' '}
              {t('indoor.buyingGuide.item3Body')}
            </li>
            <li>
              <strong>{t('indoor.buyingGuide.item4Title')}</strong>{' '}
              {t('indoor.buyingGuide.item4Body')}
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <PurifierFilterTrackerCard />
        </div>
      </div>
    </div>
  );
};
