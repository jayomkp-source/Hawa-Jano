import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AqiScale, HourlyDataPoint } from '../../types';

interface AirQualityChartsProps {
  hourly: HourlyDataPoint[];
  scale: AqiScale;
  isDark: boolean;
}

type ChartMetric = 'aqi' | 'pm25' | 'pm10' | 'no2';

export const AirQualityCharts: React.FC<AirQualityChartsProps> = ({ hourly, scale, isDark }) => {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<ChartMetric>('aqi');
  const [windowFilter, setWindowFilter] = useState<'all' | 'past' | 'forecast'>('all');

  const filtered = hourly.filter((pt) => {
    if (windowFilter === 'past') return !pt.isForecast;
    if (windowFilter === 'forecast') return pt.isForecast;
    return true;
  });

  const chartData = filtered.map((pt) => ({
    label: pt.label,
    time: pt.time,
    phase: pt.isForecast ? t('airQuality.forecast') : t('airQuality.observed'),
    value:
      metric === 'aqi'
        ? scale === 'IN_NAQI'
          ? pt.inAqi
          : pt.usAqi
        : metric === 'pm25'
          ? pt.pm25
          : metric === 'pm10'
            ? pt.pm10
            : pt.no2,
  }));

  const currentBoundaryLabel = hourly.find(
    (h) => !h.isForecast && hourly[hourly.indexOf(h) + 1]?.isForecast
  )?.label;

  const metricMeta: Record<
    ChartMetric,
    { label: string; unit: string; stroke: string; activeBtn: string }
  > = {
    aqi: {
      label: t(`scale.${scale}_SHORT`),
      unit: 'AQI',
      stroke: '#EA580C',
      activeBtn: 'bg-orange-600 text-white',
    },
    pm25: {
      label: 'PM2.5',
      unit: 'µg/m³',
      stroke: '#E11D48',
      activeBtn: 'bg-rose-600 text-white',
    },
    pm10: {
      label: 'PM10',
      unit: 'µg/m³',
      stroke: '#D97706',
      activeBtn: 'bg-amber-600 text-white',
    },
    no2: {
      label: 'NO2',
      unit: 'µg/m³',
      stroke: '#2563EB',
      activeBtn: 'bg-blue-600 text-white',
    },
  };

  const activeMeta = metricMeta[metric];
  const gridStroke = isDark ? '#1E293B' : '#E5E5E5';
  const tickColor = isDark ? '#94A3B8' : '#525252';

  return (
    <div className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-orange-600 dark:border-t-orange-400 bg-white dark:bg-[#0E131B] p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#DADADA] dark:border-[#222B3A]">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 border border-orange-200 dark:border-orange-800/70 bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center shrink-0 mt-0.5">
            <Activity className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </span>
          <div>
            <h3 className="text-base font-bold">
              {t('airQuality.chart48Title', { metric: activeMeta.label })}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
              {t('airQuality.chart48Sub')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-[#DADADA] dark:border-[#222B3A]" role="group" aria-label="Chart metric">
            {(['aqi', 'pm25', 'pm10', 'no2'] as ChartMetric[]).map((m) => {
              const isSelected = metric === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setMetric(m)}
                  className={`px-2.5 py-1.5 text-xs font-mono font-semibold uppercase flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? metricMeta[m].activeBtn
                      : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                  }`}
                >
                  <span
                    className="w-2 h-2 shrink-0"
                    style={{ backgroundColor: isSelected ? '#FFFFFF' : metricMeta[m].stroke }}
                  />
                  {m === 'aqi' ? 'AQI' : m.toUpperCase()}
                </button>
              );
            })}
          </div>

          <div className="flex border border-[#DADADA] dark:border-[#222B3A]" role="group" aria-label="Time window filter">
            {[
              { id: 'all', label: t('airQuality.view48h') },
              { id: 'past', label: t('airQuality.viewPast24h') },
              { id: 'forecast', label: t('airQuality.viewForecast') },
            ].map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={windowFilter === w.id}
                onClick={() => setWindowFilter(w.id as 'all' | 'past' | 'forecast')}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  windowFilter === w.id
                    ? 'bg-sky-600 text-white'
                    : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="h-72 w-full mt-5"
        role="img"
        aria-label={t('airQuality.chart48Title', { metric: activeMeta.label })}
      >
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-500 dark:text-slate-400">
            {t('airQuality.noHourlyPoints')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: tickColor, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={{ stroke: gridStroke }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: tickColor, fontFamily: 'JetBrains Mono' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0B0F17' : '#FFFFFF',
                  border: `1px solid ${activeMeta.stroke}`,
                  borderRadius: '0px',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono',
                }}
                formatter={(val) => [
                  val !== null && val !== undefined ? `${val} ${activeMeta.unit}` : 'N/A',
                  activeMeta.label,
                ]}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload as { phase?: string } | undefined;
                  return `${label} · ${row?.phase || ''}`;
                }}
              />
              {windowFilter === 'all' && currentBoundaryLabel && (
                <ReferenceLine
                  x={currentBoundaryLabel}
                  stroke={isDark ? '#38BDF8' : '#080808'}
                  strokeDasharray="3 3"
                  label={{
                    value: 'NOW',
                    position: 'top',
                    fill: isDark ? '#38BDF8' : '#080808',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={activeMeta.stroke}
                strokeWidth={2.25}
                fill={activeMeta.stroke}
                fillOpacity={isDark ? 0.2 : 0.12}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
