import React, { useState } from 'react';
import { Plus, RotateCcw, Trash2, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';

export const PurifierFilterTrackerCard: React.FC = () => {
  const { t } = useTranslation();
  const {
    purifierFilters,
    addPurifierFilter,
    resetPurifierFilterDate,
    removePurifierFilter,
  } = useApp();

  const [room, setRoom] = useState(() => t('indoor.filterDefaultRoom'));
  const [modelName, setModelName] = useState('');
  const [installedDate, setInstalledDate] = useState(new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(180);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) return;
    addPurifierFilter(room, modelName.trim(), installedDate, intervalDays);
    setModelName('');
  };

  return (
    <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-teal-600 dark:border-t-teal-400 bg-white dark:bg-[#0E131B] p-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center shrink-0">
          <Wrench className="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h2 className="text-base font-bold">{t('indoor.filterTitle')}</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{t('indoor.filterSub')}</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder={t('indoor.filterRoomPlaceholder')}
          aria-label={t('indoor.filterRoomPlaceholder')}
          className="px-3 py-2 text-xs bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A]"
        />
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder={t('indoor.filterModelPlaceholder')}
          aria-label={t('indoor.filterModelPlaceholder')}
          className="sm:col-span-2 px-3 py-2 text-xs bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A]"
        />
        <input
          type="date"
          value={installedDate}
          onChange={(e) => setInstalledDate(e.target.value)}
          aria-label="Filter install date"
          className="px-3 py-2 text-xs font-mono bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A]"
        />
        <button
          type="submit"
          disabled={!modelName.trim()}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('indoor.addTracker')}
        </button>
      </form>

      <div className="mt-4 flex items-center gap-3 text-xs">
        <label htmlFor="filter-interval" className="text-neutral-500 dark:text-neutral-400">
          {t('indoor.targetCycle')}
        </label>
        <select
          id="filter-interval"
          value={intervalDays}
          onChange={(e) => setIntervalDays(Number(e.target.value))}
          className="px-2 py-1 border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#151C28] font-mono text-xs"
        >
          <option value={90}>90d</option>
          <option value={180}>180d</option>
          <option value={270}>270d</option>
        </select>
      </div>

      {purifierFilters.length === 0 ? (
        <div className="mt-4 p-4 bg-[#F3F3F3] dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-xs text-neutral-500 dark:text-neutral-400">
          {t('indoor.noFilters')}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-[#DADADA] dark:divide-[#222B3A] border border-[#DADADA] dark:border-[#222B3A]">
          {purifierFilters.map((f) => {
            const daysElapsed = Math.max(
              0,
              Math.floor((Date.now() - new Date(f.installedDate).getTime()) / (1000 * 60 * 60 * 24))
            );
            const remaining = f.intervalDays - daysElapsed;
            const due = remaining <= 0;

            return (
              <div
                key={f.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-semibold">
                    {f.room} · {f.modelName}
                  </div>
                  <div className="font-mono text-neutral-500 mt-0.5">
                    {f.installedDate} · {daysElapsed}d ·{' '}
                    <span className={due ? 'text-red-600 font-bold' : 'text-green-600'}>
                      {due
                        ? t('indoor.dueDays', { days: Math.abs(remaining) })
                        : t('indoor.leftDays', { days: remaining })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resetPurifierFilterDate(f.id)}
                    className="px-2.5 py-1 border border-[#DADADA] dark:border-[#222B3A] flex items-center gap-1 hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]"
                  >
                    <RotateCcw className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    {t('indoor.replacedToday')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePurifierFilter(f.id)}
                    className="p-1.5 border border-[#DADADA] dark:border-[#222B3A] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label={`Remove ${f.modelName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
