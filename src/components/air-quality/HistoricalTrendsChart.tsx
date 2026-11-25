import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Calendar, LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../../contexts/AppContext';
import { fetchHistoricalAirQuality } from '../../services/airQualityService';
import type { HistoricalAirQualityResponse } from '../../types';

type PollutantSeriesKey = 'pm25-no2' | 'all' | 'pm25' | 'no2' | 'pm10' | 'o3';
type ChartKind = 'line' | 'bar';
type StatMode = 'avg' | 'peak';

const SERIES_META: Record<
  Exclude<PollutantSeriesKey, 'all' | 'pm25-no2'>,
  { label: string; color: string; whoLimit: number; activeBtn: string }
> = {
  pm25: { label: 'PM2.5', color: '#E11D48', whoLimit: 15, activeBtn: 'bg-rose-600 text-white' },
  no2: { label: 'NO2', color: '#2563EB', whoLimit: 25, activeBtn: 'bg-blue-600 text-white' },
  pm10: { label: 'PM10', color: '#D97706', whoLimit: 45, activeBtn: 'bg-amber-600 text-white' },
  o3: { label: 'O3', color: '#0891B2', whoLimit: 100, activeBtn: 'bg-cyan-600 text-white' },
};

export const HistoricalTrendsChart: React.FC = () => {
  const { t } = useTranslation();
  const { profile, theme } = useApp();
  const isDark = theme === 'dark';

  const [days, setDays] = useState<7 | 30>(7);
  const [chartKind, setChartKind] = useState<ChartKind>('line');
  const [statMode, setStatMode] = useState<StatMode>('avg');
  const [selectedSeries, setSelectedSeries] = useState<PollutantSeriesKey>('pm25-no2');

  const [historyData, setHistoryData] = useState<HistoricalAirQualityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const loadHistory = useCallback(async () => {
    abortRef.current?.abort();

    if (!profile.location) {
      setHistoryData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeqRef.current;

    setLoading(true);
    setError(null);
    try {
      const res = await fetchHistoricalAirQuality(profile.location, days, controller.signal);
      if (seq !== requestSeqRef.current) return;
      setHistoryData(res);
    } catch (err) {
      if ((err as Error).name === 'AbortError' || seq !== requestSeqRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : t('airQuality.historyUnavailable'));
      setHistoryData(null);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [profile.location, days, t]);

  useEffect(() => {
    void loadHistory();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadHistory]);

  const chartRows = useMemo(() => {
    if (!historyData) return [];
    return historyData.daily.map((d) => ({
      date: d.date,
      label: d.label,
      pm25: statMode === 'avg' ? d.pm25Avg : d.pm25Peak,
      pm10: statMode === 'avg' ? d.pm10Avg : d.pm10Peak,
      o3: statMode === 'avg' ? d.o3Avg : d.o3Peak,
      no2: statMode === 'avg' ? d.no2Avg : d.no2Peak,
    }));
  }, [historyData, statMode]);

  const dualStats = useMemo(() => {
    if (chartRows.length === 0) return null;
    const summarize = (key: 'pm25' | 'no2') => {
      const vals = chartRows
        .map((r) => r[key])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (vals.length === 0) return null;
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const peak = Math.max(...vals);
      return {
        avg: avg.toFixed(1),
        peak: peak.toFixed(1),
        whoLimit: SERIES_META[key].whoLimit,
      };
    };
    return {
      pm25: summarize('pm25'),
      no2: summarize('no2'),
    };
  }, [chartRows]);

  const singleStats = useMemo(() => {
    if (selectedSeries === 'all' || selectedSeries === 'pm25-no2' || chartRows.length === 0) {
      return null;
    }
    const vals = chartRows
      .map((r) => r[selectedSeries])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (vals.length === 0) return null;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const peak = Math.max(...vals);
    return {
      avg: avg.toFixed(1),
      peak: peak.toFixed(1),
      whoLimit: SERIES_META[selectedSeries].whoLimit,
    };
  }, [selectedSeries, chartRows]);

  const gridStroke = isDark ? '#1E293B' : '#E5E5E5';
  const tickColor = isDark ? '#94A3B8' : '#525252';

  const seriesToRender: Array<Exclude<PollutantSeriesKey, 'all' | 'pm25-no2'>> =
    selectedSeries === 'pm25-no2'
      ? ['pm25', 'no2']
      : selectedSeries === 'all'
        ? ['pm25', 'pm10', 'o3', 'no2']
        : [selectedSeries];

  return (
    <section className="border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-cyan-600 dark:border-t-cyan-400 bg-white dark:bg-[#0E131B] p-5 space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-[#DADADA] dark:border-[#222B3A]">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 border border-cyan-200 dark:border-cyan-800/70 bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center shrink-0 mt-0.5">
            <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </span>
          <div>
            <h2 className="text-base font-bold">{t('airQuality.historyTitle')}</h2>
            <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
              {t('airQuality.historySub')}
              {historyData ? ` · ${historyData.source}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time period toggle: 7D vs 30D */}
          <div className="flex border border-[#DADADA] dark:border-[#222B3A]" role="group" aria-label="Time period">
            <button
              type="button"
              aria-pressed={days === 7}
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                days === 7
                  ? 'bg-cyan-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              {t('airQuality.last7Days')}
            </button>
            <button
              type="button"
              aria-pressed={days === 30}
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold transition-colors ${
                days === 30
                  ? 'bg-cyan-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              {t('airQuality.last30Days')}
            </button>
          </div>

          {/* Aggregation toggle: Daily Avg vs Peak */}
          <div className="flex border border-[#DADADA] dark:border-[#222B3A]" role="group" aria-label="Aggregation">
            <button
              type="button"
              aria-pressed={statMode === 'avg'}
              onClick={() => setStatMode('avg')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                statMode === 'avg'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              {t('airQuality.dailyAvg')}
            </button>
            <button
              type="button"
              aria-pressed={statMode === 'peak'}
              onClick={() => setStatMode('peak')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                statMode === 'peak'
                  ? 'bg-orange-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              {t('airQuality.dailyPeak')}
            </button>
          </div>

          {/* Chart type toggle: Line vs Bar */}
          <div className="flex border border-[#DADADA] dark:border-[#222B3A]" role="group" aria-label="Chart type">
            <button
              type="button"
              aria-pressed={chartKind === 'line'}
              onClick={() => setChartKind('line')}
              className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                chartKind === 'line'
                  ? 'bg-purple-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" aria-hidden="true" />
              {t('airQuality.lineChart')}
            </button>
            <button
              type="button"
              aria-pressed={chartKind === 'bar'}
              onClick={() => setChartKind('bar')}
              className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                chartKind === 'bar'
                  ? 'bg-purple-600 text-white'
                  : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              {t('airQuality.barChart')}
            </button>
          </div>
        </div>
      </div>

      {/* Vibrant Color-Coded Pollutant Tabs + Period Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          className="flex flex-wrap border border-[#DADADA] dark:border-[#222B3A]"
          role="tablist"
          aria-label="Pollutant trend series"
        >
          {(
            [
              {
                id: 'pm25-no2',
                label: t('airQuality.pm25AndNo2'),
                dot: '#E11D48',
                dotSecondary: '#2563EB',
                active: 'bg-indigo-600 text-white',
              },
              {
                id: 'all',
                label: t('airQuality.allPollutants'),
                dot: '#8B5CF6',
                active: 'bg-purple-600 text-white',
              },
              { id: 'pm25', label: 'PM2.5', dot: SERIES_META.pm25.color, active: SERIES_META.pm25.activeBtn },
              { id: 'no2', label: 'NO2', dot: SERIES_META.no2.color, active: SERIES_META.no2.activeBtn },
              { id: 'pm10', label: 'PM10', dot: SERIES_META.pm10.color, active: SERIES_META.pm10.activeBtn },
              { id: 'o3', label: 'O3', dot: SERIES_META.o3.color, active: SERIES_META.o3.activeBtn },
            ] as Array<{
              id: PollutantSeriesKey;
              label: string;
              dot: string;
              dotSecondary?: string;
              active: string;
            }>
          ).map((item) => {
            const isSelected = selectedSeries === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedSeries(item.id)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
                  isSelected
                    ? item.active
                    : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                }`}
              >
                <span className="flex items-center gap-0.5 shrink-0">
                  <span
                    className="w-2 h-2"
                    style={{ backgroundColor: isSelected ? '#FFFFFF' : item.dot }}
                  />
                  {item.dotSecondary && (
                    <span
                      className="w-2 h-2"
                      style={{ backgroundColor: isSelected ? '#BFDBFE' : item.dotSecondary }}
                    />
                  )}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>

        {selectedSeries === 'pm25-no2' && dualStats && (dualStats.pm25 || dualStats.no2) ? (
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            {dualStats.pm25 && (
              <div className="px-2.5 py-1 border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/10 flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-600 shrink-0" />
                <span className="font-bold text-rose-700 dark:text-rose-300">PM2.5</span>
                <span>
                  {t('airQuality.periodAvg')}: <strong>{dualStats.pm25.avg}</strong>
                </span>
                <span className="text-neutral-600 dark:text-slate-400">
                  Peak {dualStats.pm25.peak} µg/m³
                </span>
              </div>
            )}
            {dualStats.no2 && (
              <div className="px-2.5 py-1 border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 shrink-0" />
                <span className="font-bold text-blue-700 dark:text-blue-300">NO2</span>
                <span>
                  {t('airQuality.periodAvg')}: <strong>{dualStats.no2.avg}</strong>
                </span>
                <span className="text-neutral-600 dark:text-slate-400">
                  Peak {dualStats.no2.peak} µg/m³
                </span>
              </div>
            )}
          </div>
        ) : (
          singleStats && (
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
              <span>
                {t('airQuality.periodAvg')}: <strong>{singleStats.avg} µg/m³</strong>
              </span>
              <span>
                {t('airQuality.periodPeak')}: <strong>{singleStats.peak} µg/m³</strong>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {t('airQuality.whoGuideline')}: {singleStats.whoLimit} µg/m³
              </span>
            </div>
          )
        )}
      </div>

      {/* Chart Area */}
      {!profile.location ? (
        <div className="h-64 flex items-center justify-center border border-[#DADADA] dark:border-[#222B3A] bg-[#F3F3F3] dark:bg-[#070A0F] text-xs text-neutral-500 dark:text-slate-400">
          {t('airQuality.historyEmpty')}
        </div>
      ) : loading ? (
        <div className="h-64 flex items-center justify-center border border-[#DADADA] dark:border-[#222B3A] bg-[#F3F3F3] dark:bg-[#070A0F] text-xs font-mono text-cyan-600 dark:text-cyan-400">
          {t('airQuality.historyLoading')}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="h-64 flex flex-col items-center justify-center gap-3 border border-red-600 bg-red-50 dark:bg-red-950/30 p-4 text-center"
        >
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="px-3 py-1.5 border border-red-700 dark:border-red-400 text-xs font-semibold flex items-center gap-1.5 text-red-800 dark:text-red-200"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('common.retryLiveFeed')}
          </button>
        </div>
      ) : chartRows.length === 0 ? (
        <div className="h-64 flex items-center justify-center border border-[#DADADA] dark:border-[#222B3A] text-xs text-neutral-500 dark:text-slate-400">
          {t('airQuality.historyUnavailable')}
        </div>
      ) : (
        <div
          className="h-80 w-full"
          role="img"
          aria-label={t('airQuality.historyTitle')}
        >
          <ResponsiveContainer width="100%" height="100%">
            {chartKind === 'line' ? (
              <LineChart data={chartRows} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: tickColor, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={days === 30 ? 18 : 8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: tickColor, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={false}
                  unit=" µg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0B0F17' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#38BDF8' : '#080808'}`,
                    borderRadius: '0px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(val, name) => [
                    val !== null && val !== undefined ? `${val} µg/m³` : 'N/A',
                    String(name),
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { date?: string } | undefined;
                    return row?.date || '';
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                {selectedSeries !== 'all' && selectedSeries !== 'pm25-no2' && (
                  <ReferenceLine
                    y={SERIES_META[selectedSeries].whoLimit}
                    stroke="#16A34A"
                    strokeDasharray="4 4"
                    label={{
                      value: `WHO (${SERIES_META[selectedSeries].whoLimit})`,
                      position: 'insideTopRight',
                      fill: '#16A34A',
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                )}
                {selectedSeries === 'pm25-no2' && (
                  <>
                    <ReferenceLine
                      y={SERIES_META.pm25.whoLimit}
                      stroke="#E11D48"
                      strokeDasharray="4 4"
                      label={{
                        value: `PM2.5 WHO (${SERIES_META.pm25.whoLimit})`,
                        position: 'insideTopLeft',
                        fill: '#E11D48',
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono',
                      }}
                    />
                    <ReferenceLine
                      y={SERIES_META.no2.whoLimit}
                      stroke="#2563EB"
                      strokeDasharray="4 4"
                      label={{
                        value: `NO2 WHO (${SERIES_META.no2.whoLimit})`,
                        position: 'insideTopRight',
                        fill: '#2563EB',
                        fontSize: 10,
                        fontFamily: 'JetBrains Mono',
                      }}
                    />
                  </>
                )}
                {seriesToRender.map((key) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={SERIES_META[key].label}
                    stroke={SERIES_META[key].color}
                    strokeWidth={2.25}
                    dot={days === 7 ? { r: 3 } : false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartRows} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: tickColor, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={days === 30 ? 18 : 8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: tickColor, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                  axisLine={false}
                  unit=" µg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0B0F17' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#38BDF8' : '#080808'}`,
                    borderRadius: '0px',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono',
                  }}
                  formatter={(val, name) => [
                    val !== null && val !== undefined ? `${val} µg/m³` : 'N/A',
                    String(name),
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { date?: string } | undefined;
                    return row?.date || '';
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }} />
                {selectedSeries !== 'all' && selectedSeries !== 'pm25-no2' && (
                  <ReferenceLine
                    y={SERIES_META[selectedSeries].whoLimit}
                    stroke="#16A34A"
                    strokeDasharray="4 4"
                    label={{
                      value: `WHO (${SERIES_META[selectedSeries].whoLimit})`,
                      position: 'insideTopRight',
                      fill: '#16A34A',
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                )}
                {seriesToRender.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={SERIES_META[key].label}
                    fill={SERIES_META[key].color}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
};
