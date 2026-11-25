import React from 'react';
import { Car, CloudFog, Flame, Sun, Wind } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PollutantReadings } from '../../types';

interface PollutantGridProps {
  pollutants: PollutantReadings | null;
}

export const PollutantGrid: React.FC<PollutantGridProps> = ({ pollutants }) => {
  const { t } = useTranslation();

  const items = [
    {
      key: 'PM2.5',
      value: pollutants?.pm25 ?? null,
      unit: 'µg/m³',
      note: t('airQuality.pollutants.pm25Note'),
      refLimit: 'WHO 24h: 15 · IN 24h: 60',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400',
      iconBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:border-rose-800/70',
      topBorder: 'border-t-rose-600 dark:border-t-rose-500',
    },
    {
      key: 'PM10',
      value: pollutants?.pm10 ?? null,
      unit: 'µg/m³',
      note: t('airQuality.pollutants.pm10Note'),
      refLimit: 'WHO 24h: 45 · IN 24h: 100',
      icon: Wind,
      iconColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800/70',
      topBorder: 'border-t-amber-600 dark:border-t-amber-500',
    },
    {
      key: 'NO2',
      value: pollutants?.no2 ?? null,
      unit: 'µg/m³',
      note: t('airQuality.pollutants.no2Note'),
      refLimit: 'WHO 24h: 25 · IN 24h: 80',
      icon: Car,
      iconColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800/70',
      topBorder: 'border-t-blue-600 dark:border-t-blue-500',
    },
    {
      key: 'O3',
      value: pollutants?.o3 ?? null,
      unit: 'µg/m³',
      note: t('airQuality.pollutants.o3Note'),
      refLimit: 'WHO 8h: 100 · IN 8h: 100',
      icon: Sun,
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/50 dark:border-cyan-800/70',
      topBorder: 'border-t-cyan-600 dark:border-t-cyan-400',
    },
    {
      key: 'CO',
      value: pollutants?.co !== null && pollutants?.co !== undefined ? pollutants.co / 1000 : null,
      unit: 'mg/m³',
      note: t('airQuality.pollutants.coNote'),
      refLimit: 'WHO 24h: 4 · IN 8h: 2',
      icon: CloudFog,
      iconColor: 'text-purple-600 dark:text-purple-400',
      iconBg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800/70',
      topBorder: 'border-t-purple-600 dark:border-t-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.key}
            className={`border border-[#DADADA] dark:border-[#222B3A] border-t-2 ${item.topBorder} bg-white dark:bg-[#0E131B] p-4 flex flex-col justify-between transition-colors`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 border flex items-center justify-center shrink-0 ${item.iconBg}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#080808] dark:text-slate-100">
                  {item.key}
                </span>
              </span>
              <span className="text-[11px] font-mono text-neutral-600 dark:text-slate-400">
                {item.unit}
              </span>
            </div>
            <div className="mt-3 font-mono text-2xl font-bold tabular-nums text-[#080808] dark:text-white">
              {item.value !== null ? item.value.toFixed(item.key === 'CO' ? 2 : 1) : '—'}
            </div>
            <div className="mt-2 pt-2 border-t border-[#DADADA] dark:border-[#222B3A]">
              <div className="text-[11px] text-neutral-600 dark:text-slate-300">{item.note}</div>
              <div className="text-[10px] font-mono text-neutral-600 dark:text-slate-400 mt-0.5">
                {item.refLimit}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
