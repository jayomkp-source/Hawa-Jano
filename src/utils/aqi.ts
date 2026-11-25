import type {
  AqiBandKey,
  AqiScale,
  LocationData,
  PollutantReadings,
  ScaleReading,
  SupportedLanguage,
} from '../types';

export interface AqiCategoryMeta {
  band: AqiBandKey;
  label: string;
  shortLabel: string;
  labelKey: string;
  shortLabelKey: string;
  rangeText: string;
  textColorClass: string;
  bgColorClass: string;
  borderColorClass: string;
  hex: string;
  explanation: string;
  explanationKey: string;
  sensitiveGroupAdvice: string;
  sensitiveGroupAdviceKey: string;
  exerciseSafe: boolean;
  ventilationRecommended: boolean;
}

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

const IN_PM25_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 30.01, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 60.01, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 90.01, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 120.01, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 250.01, cHigh: 500, iLow: 401, iHigh: 500 },
];

const IN_PM10_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50.01, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100.01, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 250.01, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 350.01, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 430.01, cHigh: 600, iLow: 401, iHigh: 500 },
];

const IN_NO2_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40.01, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80.01, cHigh: 180, iLow: 101, iHigh: 200 },
  { cLow: 180.01, cHigh: 280, iLow: 201, iHigh: 300 },
  { cLow: 280.01, cHigh: 400, iLow: 301, iHigh: 400 },
  { cLow: 400.01, cHigh: 600, iLow: 401, iHigh: 500 },
];

const IN_O3_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50.01, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100.01, cHigh: 168, iLow: 101, iHigh: 200 },
  { cLow: 168.01, cHigh: 208, iLow: 201, iHigh: 300 },
  { cLow: 208.01, cHigh: 748, iLow: 301, iHigh: 400 },
  { cLow: 748.01, cHigh: 1000, iLow: 401, iHigh: 500 },
];

const IN_CO_MG_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 1.0, iLow: 0, iHigh: 50 },
  { cLow: 1.01, cHigh: 2.0, iLow: 51, iHigh: 100 },
  { cLow: 2.01, cHigh: 10.0, iLow: 101, iHigh: 200 },
  { cLow: 10.01, cHigh: 17.0, iLow: 201, iHigh: 300 },
  { cLow: 17.01, cHigh: 34.0, iLow: 301, iHigh: 400 },
  { cLow: 34.01, cHigh: 50.0, iLow: 401, iHigh: 500 },
];

const IN_SO2_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40.01, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80.01, cHigh: 380, iLow: 101, iHigh: 200 },
  { cLow: 380.01, cHigh: 800, iLow: 201, iHigh: 300 },
  { cLow: 800.01, cHigh: 1600, iLow: 301, iHigh: 400 },
  { cLow: 1600.01, cHigh: 2500, iLow: 401, iHigh: 500 },
];

export function toFiniteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function toNonNegativeNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

export function isAirQualityStale(
  measuredAt: string | null | undefined,
  thresholdHours = 3,
  nowMs = Date.now()
): boolean {
  if (!measuredAt || typeof measuredAt !== 'string') return true;
  const parsedMs = new Date(measuredAt).getTime();
  if (Number.isNaN(parsedMs)) return true;
  return nowMs - parsedMs > thresholdHours * 60 * 60 * 1000;
}

function calcSubIndex(concentration: number | null, bps: Breakpoint[]): number | null {
  if (concentration === null || !Number.isFinite(concentration) || concentration < 0) {
    return null;
  }
  for (const bp of bps) {
    if (concentration <= bp.cHigh) {
      const ratio = (concentration - bp.cLow) / (bp.cHigh - bp.cLow);
      return Math.max(bp.iLow, Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow)));
    }
  }
  const last = bps[bps.length - 1];
  return Math.min(999, Math.round(last.iHigh + (concentration - last.cHigh) * 0.4));
}

export function computeIndianNaqi(pollutants: PollutantReadings): ScaleReading {
  const candidates: Array<{ name: string; sub: number | null }> = [
    { name: 'PM2.5', sub: calcSubIndex(pollutants.pm25, IN_PM25_BP) },
    { name: 'PM10', sub: calcSubIndex(pollutants.pm10, IN_PM10_BP) },
    { name: 'NO2', sub: calcSubIndex(pollutants.no2, IN_NO2_BP) },
    { name: 'O3', sub: calcSubIndex(pollutants.o3, IN_O3_BP) },
    {
      name: 'CO',
      sub: calcSubIndex(
        pollutants.co !== null && Number.isFinite(pollutants.co) && pollutants.co >= 0
          ? pollutants.co / 1000
          : null,
        IN_CO_MG_BP
      ),
    },
    { name: 'SO2', sub: calcSubIndex(pollutants.so2, IN_SO2_BP) },
  ];

  const valid = candidates.filter((c): c is { name: string; sub: number } => c.sub !== null);
  if (valid.length === 0) {
    return { value: null, dominantPollutant: null };
  }

  valid.sort((a, b) => b.sub - a.sub);
  return {
    value: valid[0].sub,
    dominantPollutant: valid[0].name,
  };
}

export function resolveActiveScale(
  preferredScale: 'auto' | AqiScale,
  location: LocationData | null
): AqiScale {
  if (preferredScale !== 'auto') {
    return preferredScale;
  }
  if (!location) {
    return 'IN_NAQI';
  }
  const cc = location.countryCode.toUpperCase();
  if (cc === 'IN') {
    return 'IN_NAQI';
  }
  return 'US_EPA';
}

export function getScaleTitle(scale: AqiScale): string {
  return scale === 'IN_NAQI' ? 'Indian National AQI (CPCB)' : 'US EPA AQI';
}

export function getScaleShortName(scale: AqiScale): string {
  return scale === 'IN_NAQI' ? 'IN NAQI' : 'US AQI';
}

export function getAqiCategory(value: number | null, scale: AqiScale): AqiCategoryMeta {
  if (value === null || Number.isNaN(value)) {
    return {
      band: 'unavailable',
      label: 'Unavailable',
      shortLabel: 'N/A',
      labelKey: 'aqiBands.unavailable',
      shortLabelKey: 'common.na',
      rangeText: '—',
      textColorClass: 'text-neutral-600 dark:text-neutral-400',
      bgColorClass: 'bg-neutral-500',
      borderColorClass: 'border-neutral-400',
      hex: '#737373',
      explanation: 'Live air quality data is currently unavailable.',
      explanationKey: 'aqiAdvice.unavailable',
      sensitiveGroupAdvice: 'Check local advisories if outdoor haze is visible.',
      sensitiveGroupAdviceKey: 'aqiAdvice.unavailableSensitive',
      exerciseSafe: false,
      ventilationRecommended: false,
    };
  }

  if (scale === 'IN_NAQI') {
    if (value <= 50) {
      return {
        band: 'good',
        label: 'Good',
        shortLabel: 'Good',
        labelKey: 'aqiBands.good',
        shortLabelKey: 'aqiBands.good',
        rangeText: '0–50',
        textColorClass: 'text-green-600 dark:text-green-400',
        bgColorClass: 'bg-green-600',
        borderColorClass: 'border-green-600',
        hex: '#16A34A',
        explanation:
          'Air quality is good with minimal impact. Outdoor activity and natural cross-ventilation are generally favorable.',
        explanationKey: 'aqiAdvice.inGood',
        sensitiveGroupAdvice: 'Normal outdoor activity is safe for most people.',
        sensitiveGroupAdviceKey: 'aqiAdvice.inGoodSens',
        exerciseSafe: true,
        ventilationRecommended: true,
      };
    }
    if (value <= 100) {
      return {
        band: 'satisfactory',
        label: 'Satisfactory',
        shortLabel: 'Satisfactory',
        labelKey: 'aqiBands.satisfactory',
        shortLabelKey: 'aqiBands.satisfactory',
        rangeText: '51–100',
        textColorClass: 'text-yellow-600 dark:text-yellow-400',
        bgColorClass: 'bg-yellow-500',
        borderColorClass: 'border-yellow-500',
        hex: '#CA8A04',
        explanation:
          'Air quality is satisfactory. Minor breathing discomfort may occur for unusually sensitive people.',
        explanationKey: 'aqiAdvice.inSat',
        sensitiveGroupAdvice:
          'People with asthma or respiratory sensitivity should monitor symptoms during brisk outdoor exertion.',
        sensitiveGroupAdviceKey: 'aqiAdvice.inSatSens',
        exerciseSafe: true,
        ventilationRecommended: true,
      };
    }
    if (value <= 200) {
      return {
        band: 'moderate',
        label: 'Moderate',
        shortLabel: 'Moderate',
        labelKey: 'aqiBands.moderate',
        shortLabelKey: 'aqiBands.moderate',
        rangeText: '101–200',
        textColorClass: 'text-yellow-700 dark:text-yellow-400',
        bgColorClass: 'bg-yellow-500',
        borderColorClass: 'border-yellow-500',
        hex: '#EAB308',
        explanation:
          'Air quality is moderate. People with lung disease, asthma, heart conditions, children, and older adults may experience discomfort.',
        explanationKey: 'aqiAdvice.inMod',
        sensitiveGroupAdvice:
          'Reduce prolonged heavy outdoor exertion for children, elderly adults, and sensitive individuals.',
        sensitiveGroupAdviceKey: 'aqiAdvice.inModSens',
        exerciseSafe: false,
        ventilationRecommended: false,
      };
    }
    if (value <= 300) {
      return {
        band: 'poor',
        label: 'Poor',
        shortLabel: 'Poor',
        labelKey: 'aqiBands.poor',
        shortLabelKey: 'aqiBands.poor',
        rangeText: '201–300',
        textColorClass: 'text-orange-600 dark:text-orange-400',
        bgColorClass: 'bg-orange-600',
        borderColorClass: 'border-orange-600',
        hex: '#EA580C',
        explanation:
          'Air quality is currently poor. Consider reducing prolonged outdoor activity, especially for children and people sensitive to air pollution.',
        explanationKey: 'aqiAdvice.inPoor',
        sensitiveGroupAdvice:
          'Keep windows closed during smog peaks, move workouts indoors, and wear a well-fitted N95/FFP2 mask outdoors.',
        sensitiveGroupAdviceKey: 'aqiAdvice.inPoorSens',
        exerciseSafe: false,
        ventilationRecommended: false,
      };
    }
    if (value <= 400) {
      return {
        band: 'very-poor',
        label: 'Very Poor',
        shortLabel: 'Very Poor',
        labelKey: 'aqiBands.veryPoor',
        shortLabelKey: 'aqiBands.veryPoor',
        rangeText: '301–400',
        textColorClass: 'text-red-600 dark:text-red-400',
        bgColorClass: 'bg-red-600',
        borderColorClass: 'border-red-600',
        hex: '#DC2626',
        explanation:
          'Air quality is very poor. Prolonged exposure can cause respiratory illness and significant discomfort even in healthy individuals.',
        explanationKey: 'aqiAdvice.inVeryPoor',
        sensitiveGroupAdvice:
          'Avoid outdoor exercise. Children, elderly, and sensitive groups should remain indoors with HEPA filtration if available.',
        sensitiveGroupAdviceKey: 'aqiAdvice.inVeryPoorSens',
        exerciseSafe: false,
        ventilationRecommended: false,
      };
    }
    return {
      band: 'severe',
      label: 'Severe',
      shortLabel: 'Severe',
      labelKey: 'aqiBands.severe',
      shortLabelKey: 'aqiBands.severe',
      rangeText: '401–500+',
      textColorClass: 'text-red-800 dark:text-red-300',
      bgColorClass: 'bg-red-800',
      borderColorClass: 'border-red-800',
      hex: '#991B1B',
      explanation:
        'Air quality is severe. Hazardous pollution levels affect healthy people and seriously impact vulnerable individuals.',
      explanationKey: 'aqiAdvice.inSevere',
      sensitiveGroupAdvice:
        'Follow local public-health advisories, stay indoors, seal drafts, use HEPA filtration, and seek urgent care for breathing distress.',
      sensitiveGroupAdviceKey: 'aqiAdvice.inSevereSens',
      exerciseSafe: false,
      ventilationRecommended: false,
    };
  }

  // US EPA AQI Scale
  if (value <= 50) {
    return {
      band: 'good',
      label: 'Good',
      shortLabel: 'Good',
      labelKey: 'aqiBands.good',
      shortLabelKey: 'aqiBands.good',
      rangeText: '0–50',
      textColorClass: 'text-green-600 dark:text-green-400',
      bgColorClass: 'bg-green-600',
      borderColorClass: 'border-green-600',
      hex: '#16A34A',
      explanation:
        'Air quality is good and poses little or no risk. Great conditions for outdoor exercise and natural ventilation.',
      explanationKey: 'aqiAdvice.usGood',
      sensitiveGroupAdvice: 'Safe for outdoor activity across all age groups.',
      sensitiveGroupAdviceKey: 'aqiAdvice.usGoodSens',
      exerciseSafe: true,
      ventilationRecommended: true,
    };
  }
  if (value <= 100) {
    return {
      band: 'satisfactory',
      label: 'Moderate',
      shortLabel: 'Moderate',
      labelKey: 'aqiBands.moderate',
      shortLabelKey: 'aqiBands.moderate',
      rangeText: '51–100',
      textColorClass: 'text-yellow-600 dark:text-yellow-400',
      bgColorClass: 'bg-yellow-500',
      borderColorClass: 'border-yellow-500',
      hex: '#CA8A04',
      explanation:
        'Air quality is acceptable, though a small number of people unusually sensitive to pollution may notice mild symptoms.',
      explanationKey: 'aqiAdvice.usMod',
      sensitiveGroupAdvice:
        'Unusually sensitive individuals should consider limiting prolonged intense outdoor exertion.',
      sensitiveGroupAdviceKey: 'aqiAdvice.usModSens',
      exerciseSafe: true,
      ventilationRecommended: true,
    };
  }
  if (value <= 150) {
    return {
      band: 'poor',
      label: 'Poor (USG)',
      shortLabel: 'Poor',
      labelKey: 'aqiBands.poorUsg',
      shortLabelKey: 'aqiBands.poor',
      rangeText: '101–150',
      textColorClass: 'text-orange-600 dark:text-orange-400',
      bgColorClass: 'bg-orange-600',
      borderColorClass: 'border-orange-600',
      hex: '#EA580C',
      explanation:
        'Air quality is unhealthy for sensitive groups. Children, older adults, and people with heart or lung conditions may experience effects.',
      explanationKey: 'aqiAdvice.usUsg',
      sensitiveGroupAdvice:
        'Reduce prolonged outdoor exertion for children, elderly family members, and anyone with asthma.',
      sensitiveGroupAdviceKey: 'aqiAdvice.usUsgSens',
      exerciseSafe: false,
      ventilationRecommended: false,
    };
  }
  if (value <= 200) {
    return {
      band: 'very-poor',
      label: 'Very Poor',
      shortLabel: 'Very Poor',
      labelKey: 'aqiBands.veryPoor',
      shortLabelKey: 'aqiBands.veryPoor',
      rangeText: '151–200',
      textColorClass: 'text-red-600 dark:text-red-400',
      bgColorClass: 'bg-red-600',
      borderColorClass: 'border-red-600',
      hex: '#DC2626',
      explanation:
        'Air quality is unhealthy. Everyone may begin to experience health effects, with more serious effects for sensitive groups.',
      explanationKey: 'aqiAdvice.usPoor',
      sensitiveGroupAdvice:
        'Move exercise indoors, limit outdoor errands, and use well-fitted N95 protection if commuting.',
      sensitiveGroupAdviceKey: 'aqiAdvice.usPoorSens',
      exerciseSafe: false,
      ventilationRecommended: false,
    };
  }
  if (value <= 300) {
    return {
      band: 'very-poor',
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      labelKey: 'aqiBands.veryUnhealthy',
      shortLabelKey: 'aqiBands.veryUnhealthy',
      rangeText: '201–300',
      textColorClass: 'text-red-700 dark:text-red-400',
      bgColorClass: 'bg-red-700',
      borderColorClass: 'border-red-700',
      hex: '#B91C1C',
      explanation:
        'Health alert: the risk of health effects is increased for everyone.',
      explanationKey: 'aqiAdvice.usVeryUnhealthy',
      sensitiveGroupAdvice:
        'Avoid outdoor physical exertion and keep indoor spaces sealed and filtered.',
      sensitiveGroupAdviceKey: 'aqiAdvice.usVeryUnhealthySens',
      exerciseSafe: false,
      ventilationRecommended: false,
    };
  }
  return {
    band: 'severe',
    label: 'Severe / Hazardous',
    shortLabel: 'Severe',
    labelKey: 'aqiBands.severeHazardous',
    shortLabelKey: 'aqiBands.severe',
    rangeText: '301–500+',
    textColorClass: 'text-red-800 dark:text-red-300',
    bgColorClass: 'bg-red-800',
    borderColorClass: 'border-red-800',
    hex: '#991B1B',
    explanation:
      'Emergency conditions: hazardous air quality affects the entire population.',
    explanationKey: 'aqiAdvice.usSevere',
    sensitiveGroupAdvice:
      'Follow local public-health guidance, stay indoors, run HEPA filtration, and seek medical care for severe breathing symptoms.',
    sensitiveGroupAdviceKey: 'aqiAdvice.usSevereSens',
    exerciseSafe: false,
    ventilationRecommended: false,
  };
}

export function inferLikelyContributors(
  pollutants: PollutantReadings,
  language: SupportedLanguage = 'en'
): string[] {
  const insights: string[] = [];
  const { pm25, pm10, no2, o3, co } = pollutants;
  const isHi = language === 'hi';

  if (pm25 !== null && pm10 !== null && pm10 > 0) {
    const ratio = pm25 / pm10;
    if (pm25 > 60 && ratio >= 0.55) {
      insights.push(
        isHi
          ? `सूक्ष्म कणों की अधिकता (PM2.5/PM10 अनुपात ${(ratio * 100).toFixed(0)}%) सामान्यतः वाहनों के धुएं, सर्दियों की हीटिंग, बायोमास दहन या स्थिर शहरी स्मॉग की ओर संकेत करती है।`
          : `Fine particulate dominance (PM2.5/PM10 ratio ${(ratio * 100).toFixed(0)}%) typically points to combustion sources such as vehicle exhaust, winter heating, biomass burning, or stagnant urban smog.`
      );
    } else if (pm10 > 100 && ratio < 0.5) {
      insights.push(
        isHi
          ? `मोटे कणों में वृद्धि (PM10 ${pm10.toFixed(0)} µg/m³ बनाम PM2.5 ${pm25.toFixed(0)} µg/m³) अक्सर सड़क की धूल, निर्माण कार्य या तेज हवा से उड़ती धूल को दर्शाती है।`
          : `Coarse particulate elevation (PM10 ${pm10.toFixed(0)} µg/m³ relative to PM2.5 ${pm25.toFixed(0)} µg/m³) commonly reflects resuspended road dust, construction activity, or dry wind-blown dust.`
      );
    }
  } else if (pm25 !== null && pm25 > 60) {
    insights.push(
      isHi
        ? `उच्च PM2.5 (${pm25.toFixed(1)} µg/m³) ईंधन दहन, खाना पकाने के धुएं या फंसे हुए शीतकालीन धुंध से बढ़े सूक्ष्म कणों को दर्शाता है।`
        : `Elevated PM2.5 (${pm25.toFixed(1)} µg/m³) indicates high fine-particle load associated with fuel combustion, cooking smoke, or trapped winter haze.`
    );
  }

  if (no2 !== null && no2 > 45) {
    insights.push(
      isHi
        ? `बढ़ी हुई NO2 (${no2.toFixed(1)} µg/m³) व्यस्त सड़कों के पास यातायात उत्सर्जन और डीज़ल/गैस दहन से गहराई से जुड़ी होती है।`
        : `Elevated NO2 (${no2.toFixed(1)} µg/m³) is strongly associated with road traffic emissions and diesel/gas combustion near busy corridors.`
    );
  }

  if (o3 !== null && o3 > 100) {
    insights.push(
      isHi
        ? `बढ़ी हुई जमीनी ओज़ोन (${o3.toFixed(1)} µg/m³) धूप में ट्रैफ़िक/औद्योगिक उत्सर्जन और वाष्पशील कार्बनिक यौगिकों की रासायनिक क्रिया से बनती है।`
        : `Elevated ground-level ozone (${o3.toFixed(1)} µg/m³) forms through sunlight-driven reactions between traffic/industrial emissions and volatile organic compounds.`
    );
  }

  if (co !== null && co > 1500) {
    insights.push(
      isHi
        ? `उच्च कार्बन मोनोऑक्साइड (${(co / 1000).toFixed(2)} mg/m³) अक्सर खड़े वाहनों के इंजन, जनरेटर या ठोस ईंधन के अधूरे दहन का संकेत देता है।`
        : `Higher carbon monoxide (${(co / 1000).toFixed(2)} mg/m³) often signals incomplete combustion from idling traffic, generators, or solid-fuel burning.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      isHi
        ? 'मापे गए प्रदूषक स्तर अभी किसी एक स्रोत के तीव्र उछाल को नहीं दिखा रहे हैं; प्रति-घंटा हवा और फैलाव पर नज़र रखें।'
        : 'Measured pollutant concentrations do not show an acute single-source spike right now; continue tracking hourly dispersion and wind changes.'
    );
  }

  return insights;
}

export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
