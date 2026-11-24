import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AqiScale } from '../../types';

interface AqiGaugeProps {
  value: number | null;
  scale: AqiScale;
}

export const AqiGauge: React.FC<AqiGaugeProps> = ({ value, scale }) => {
  const { t } = useTranslation();

  const segments =
    scale === 'IN_NAQI'
      ? [
          { label: t('aqiBands.good'), range: '0–50', color: '#16A34A' },
          {
            label: `${t('aqiBands.satisfactory')} / ${t('aqiBands.moderate')}`,
            range: '51–200',
            color: '#EAB308',
          },
          { label: t('aqiBands.poor'), range: '201–300', color: '#EA580C' },
          { label: t('aqiBands.veryPoor'), range: '301–400', color: '#DC2626' },
          { label: t('aqiBands.severe'), range: '401–500+', color: '#991B1B' },
        ]
      : [
          { label: t('aqiBands.good'), range: '0–50', color: '#16A34A' },
          { label: t('aqiBands.moderate'), range: '51–100', color: '#EAB308' },
          { label: t('aqiBands.poorUsg'), range: '101–150', color: '#EA580C' },
          { label: t('aqiBands.veryPoor'), range: '151–300', color: '#DC2626' },
          { label: t('aqiBands.severe'), range: '301–500+', color: '#991B1B' },
        ];

  const clampedPct =
    value !== null && !Number.isNaN(value) ? Math.min(100, Math.max(0, (value / 500) * 100)) : null;

  return (
    <div className="w-full" aria-label={`AQI scale visual gauge for ${scale}`}>
      <div className="relative pt-4 pb-1">
        {clampedPct !== null && (
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-200"
            style={{ left: `${clampedPct}%` }}
          >
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-[#080808] text-white dark:bg-white dark:text-[#080808] tabular-nums">
              {value}
            </span>
            <div className="w-0.5 h-3 bg-[#080808] dark:bg-white" />
          </div>
        )}

        <div className="grid grid-cols-5 gap-0.5 h-3 w-full border border-[#DADADA] dark:border-[#222B3A] p-0.5 bg-white dark:bg-[#070A0F]">
          {segments.map((seg) => (
            <div
              key={seg.range}
              className="h-full"
              style={{ backgroundColor: seg.color }}
              title={`${seg.label}: ${seg.range}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 mt-2 text-[11px] leading-tight">
        {segments.map((seg) => (
          <div key={seg.range} className="min-w-0">
            <div className="font-medium text-[#080808] dark:text-white truncate">{seg.label}</div>
            <div className="font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
              {seg.range}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
