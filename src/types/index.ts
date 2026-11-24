export type NavTab =
  | 'overview'
  | 'air-quality'
  | 'planner'
  | 'indoor-air'
  | 'eco-alternatives'
  | 'community'
  | 'assistant';

export type SupportedLanguage = 'en' | 'hi';

export type AqiScale = 'IN_NAQI' | 'US_EPA';

export type AqiBandKey =
  | 'good'
  | 'satisfactory'
  | 'moderate'
  | 'poor'
  | 'very-poor'
  | 'severe'
  | 'unavailable';

export interface LocationData {
  name: string;
  city: string;
  district?: string;
  region?: string;
  country: string;
  countryCode: string;
  pinCode?: string;
  latitude: number;
  longitude: number;
  source: 'geolocation' | 'manual';
  updatedAt: string;
}

export type LifestyleRole =
  | 'student'
  | 'office-worker'
  | 'outdoor-worker'
  | 'parent'
  | 'elderly'
  | 'work-from-home'
  | 'other';

export type CommuteMode =
  | 'walk-cycle'
  | 'public-transport'
  | 'private-vehicle'
  | 'wfh';

export type DietPreference = 'vegetarian' | 'non-vegetarian' | 'flexible';

export type BudgetPreference = 'zero-low' | 'moderate' | 'flexible';

export interface HouseholdInfo {
  familyMembers: number;
  hasChildren: boolean;
  hasElderly: boolean;
  hasPets: boolean;
  typicalOutdoorActivity: 'minimal' | 'light' | 'moderate' | 'high';
}

export interface UserPreferences {
  commuteMode: CommuteMode;
  diet: DietPreference;
  budget: BudgetPreference;
}

export interface UserProfile {
  onboardingCompleted: boolean;
  displayName: string;
  location: LocationData | null;
  preferredScale: 'auto' | AqiScale;
  lifestyle: LifestyleRole;
  household: HouseholdInfo;
  preferences: UserPreferences;
}

export interface PollutantReadings {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  co: number | null;
  so2: number | null;
}

export interface WeatherData {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  weatherCode: number | null;
  weatherLabel: string;
  isDay: boolean | null;
}

export interface HourlyDataPoint {
  time: string;
  label: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  usAqi: number | null;
  inAqi: number | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  isForecast: boolean;
}

export interface ScaleReading {
  value: number | null;
  dominantPollutant: string | null;
}

export interface AirQualitySnapshot {
  locationName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  measuredAt: string;
  fetchedAt: string;
  source: string;
  stationName?: string;
  stationCoverage?: 'verified' | 'gridded-model' | 'unavailable';
  stationNotice?: string;
  pollutants: PollutantReadings;
  weather: WeatherData;
  scales: {
    IN_NAQI: ScaleReading;
    US_EPA: ScaleReading;
  };
  hourly: HourlyDataPoint[];
  previous24hAvgAqi: {
    IN_NAQI: number | null;
    US_EPA: number | null;
  };
}

export interface AirQualityState {
  data: AirQualitySnapshot | null;
  cachedData: AirQualitySnapshot | null;
  loading: boolean;
  error: string | null;
}

export type RoutineTimeBlock = 'morning' | 'afternoon' | 'evening' | 'night';

export interface RoutineRecommendation {
  id: string;
  timeBlock: RoutineTimeBlock;
  whatToDo: string;
  whyItMatters: string;
  howToDoIt: string;
  estimatedImpact: string;
  cost: string;
  difficulty: 'Easy' | 'Moderate' | 'Challenging';
  whoBenefits: string;
}

export interface DailyRoutinePlan {
  generatedAt: string;
  locationName: string;
  aqiSummary: string;
  safetyNote: string;
  recommendations: RoutineRecommendation[];
}

export interface PurifierFilterTracker {
  id: string;
  room: string;
  modelName: string;
  installedDate: string;
  intervalDays: number;
}

export interface EcoAlternative {
  id: string;
  category: 'transport' | 'household' | 'lifestyle';
  title: string;
  originalActivity: string;
  sustainableAlternative: string;
  estimatedEmissionsDeltaKgPerWeek: number;
  emissionsAssumption: string;
  estimatedMoneySavedPerMonthInr: number | null;
  estimatedMoneySavedPerMonthUsd: number | null;
  moneyAssumption: string;
  difficulty: 'Easy' | 'Moderate' | 'Effort';
  environmentalBenefit: string;
  directImpact: string;
  personalBenefit: string;
  communityBenefit: string;
  personalExposureNote: string;
  dietTag?: 'vegetarian' | 'all';
  outdoorAirSensitive?: boolean;
}

export interface CommunityInitiative {
  id: string;
  category:
    | 'local-initiative'
    | 'awareness'
    | 'neighborhood'
    | 'school'
    | 'green-space'
    | 'transit'
    | 'challenge';
  title: string;
  summary: string;
  steps: string[];
  targetParticipants: string;
  estimatedTime: string;
  shareMessage: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  error?: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  browserNotifications: boolean;
  aqiAlertThreshold: number;
  poorExerciseAlerts: boolean;
  ventilationWindowAlerts: boolean;
  purifierFilterReminders: boolean;
  dailyEcoReminders: boolean;
  weatherChangeAlerts: boolean;
}

export interface AppNotification {
  id: string;
  type: 'aqi' | 'exercise' | 'ventilation' | 'filter' | 'eco' | 'weather';
  severity: 'positive' | 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: string;
  actionTab?: NavTab;
}

export interface GeocodeResult {
  name: string;
  city: string;
  district?: string;
  region?: string;
  country: string;
  countryCode: string;
  pinCode?: string;
  latitude: number;
  longitude: number;
}

export interface HistoricalDailyPoint {
  date: string;
  label: string;
  pm25Avg: number | null;
  pm25Peak: number | null;
  pm10Avg: number | null;
  pm10Peak: number | null;
  o3Avg: number | null;
  o3Peak: number | null;
  no2Avg: number | null;
  no2Peak: number | null;
  inAqiAvg: number | null;
  usAqiAvg: number | null;
}

export interface HistoricalAirQualityResponse {
  locationName: string;
  days: 7 | 30;
  source: string;
  fetchedAt: string;
  daily: HistoricalDailyPoint[];
}
