import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  fetchLiveAirQuality,
  loadCachedAirQuality,
} from '../services/airQualityService';
import { generateDailyRoutine } from '../services/geminiService';
import { analyzeAtmosphericDispersion } from '../services/weatherService';
import type {
  AirQualitySnapshot,
  AirQualityState,
  AppNotification,
  AqiScale,
  ChatMessage,
  DailyRoutinePlan,
  LocationData,
  NavTab,
  NotificationSettings,
  PurifierFilterTracker,
  SupportedLanguage,
  UserProfile,
} from '../types';
import {
  getAqiCategory,
  isAirQualityStale,
  resolveActiveScale,
  type AqiCategoryMeta,
} from '../utils/aqi';

const DEFAULT_PROFILE: UserProfile = {
  onboardingCompleted: false,
  displayName: '',
  location: null,
  preferredScale: 'auto',
  lifestyle: 'office-worker',
  household: {
    familyMembers: 2,
    hasChildren: false,
    hasElderly: false,
    hasPets: false,
    typicalOutdoorActivity: 'moderate',
  },
  preferences: {
    commuteMode: 'public-transport',
    diet: 'flexible',
    budget: 'moderate',
  },
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  browserNotifications: false,
  aqiAlertThreshold: 200,
  poorExerciseAlerts: true,
  ventilationWindowAlerts: true,
  purifierFilterReminders: true,
  dailyEcoReminders: true,
  weatherChangeAlerts: true,
};

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content:
    "Hey! I'm your AIRWISE companion. Let's make your home and daily routine cleaner, safer, and more sustainable. Ask me anything in English, Hindi, or Hinglish—whether it's checking if a morning walk is safe or planning cleaner indoor air.",
  timestamp: new Date().toISOString(),
};

interface AppContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  profile: UserProfile;
  updateProfile: (updater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => void;
  setLocation: (loc: LocationData) => void;
  resetAllLocalData: () => void;

  airQuality: AirQualityState;
  refreshAirQuality: () => Promise<void>;
  activeScale: AqiScale;
  activeAqiValue: number | null;
  activeDominantPollutant: string | null;
  activeCategory: AqiCategoryMeta;
  effectiveSnapshot: AirQualitySnapshot | null;
  isShowingCachedData: boolean;
  isReadingStale: boolean;

  routinePlan: DailyRoutinePlan | null;
  routineLoading: boolean;
  routineError: string | null;
  generateRoutine: () => Promise<void>;
  completedRoutineIds: string[];
  toggleRoutineDone: (id: string) => void;

  completedIndoorTasks: string[];
  toggleIndoorTask: (id: string) => void;
  purifierFilters: PurifierFilterTracker[];
  addPurifierFilter: (room: string, modelName: string, installedDate: string, intervalDays: number) => void;
  resetPurifierFilterDate: (id: string) => void;
  removePurifierFilter: (id: string) => void;

  committedEcoIds: string[];
  toggleCommitEco: (id: string) => void;

  joinedCommunityIds: string[];
  toggleJoinCommunity: (id: string) => void;
  completedCommunitySteps: string[];
  toggleCommunityStep: (key: string) => void;

  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearChat: () => void;

  notificationSettings: NotificationSettings;
  updateNotificationSettings: (patch: Partial<NotificationSettings>) => void;
  notifications: AppNotification[];
  dismissedNotificationIds: string[];
  dismissNotification: (id: string) => void;
  requestBrowserNotificationPermission: () => Promise<boolean>;

  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n, t } = useTranslation();
  const language: SupportedLanguage = i18n.language === 'hi' ? 'hi' : 'en';
  const setLanguage = useCallback(
    (lang: SupportedLanguage) => {
      void i18n.changeLanguage(lang);
    },
    [i18n]
  );

  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('airwise_theme_v1', 'light');
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [profile, setProfile] = useLocalStorage<UserProfile>(
    'airwise_user_profile_v1',
    DEFAULT_PROFILE
  );

  const [airQuality, setAirQuality] = useState<AirQualityState>({
    data: null,
    cachedData: loadCachedAirQuality(profile.location),
    loading: false,
    error: null,
  });

  const [routinePlan, setRoutinePlan] = useLocalStorage<DailyRoutinePlan | null>(
    'airwise_daily_routine_v1',
    null
  );
  const [routineLoading, setRoutineLoading] = useState(false);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const [completedRoutineIds, setCompletedRoutineIds] = useLocalStorage<string[]>(
    'airwise_completed_routine_v1',
    []
  );

  const [completedIndoorTasks, setCompletedIndoorTasks] = useLocalStorage<string[]>(
    'airwise_indoor_tasks_v1',
    []
  );
  const [purifierFilters, setPurifierFilters] = useLocalStorage<PurifierFilterTracker[]>(
    'airwise_purifier_filters_v1',
    []
  );

  const [committedEcoIds, setCommittedEcoIds] = useLocalStorage<string[]>(
    'airwise_committed_eco_v1',
    []
  );

  const [joinedCommunityIds, setJoinedCommunityIds] = useLocalStorage<string[]>(
    'airwise_joined_community_v1',
    []
  );
  const [completedCommunitySteps, setCompletedCommunitySteps] = useLocalStorage<string[]>(
    'airwise_community_steps_v1',
    []
  );

  const [chatMessages, setChatMessages] = useLocalStorage<ChatMessage[]>(
    'airwise_chat_history_v1',
    [INITIAL_ASSISTANT_MESSAGE]
  );

  const [notificationSettings, setNotificationSettings] = useLocalStorage<NotificationSettings>(
    'airwise_notification_settings_v1',
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [dismissedNotificationIds, setDismissedNotificationIds] = useLocalStorage<string[]>(
    'airwise_dismissed_notifications_v1',
    []
  );

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, [setTheme]);

  const updateProfile = useCallback(
    (updater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => {
      setProfile((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    },
    [setProfile]
  );

  const setLocation = useCallback(
    (loc: LocationData) => {
      setProfile((prev) => ({
        ...prev,
        location: loc,
      }));
    },
    [setProfile]
  );

  const aqAbortRef = useRef<AbortController | null>(null);
  const aqRequestSeqRef = useRef(0);

  const refreshAirQuality = useCallback(async () => {
    aqAbortRef.current?.abort();
    const requestSeq = ++aqRequestSeqRef.current;

    if (!profile.location) {
      aqAbortRef.current = null;
      setAirQuality({
        data: null,
        cachedData: null,
        loading: false,
        error: null,
      });
      return;
    }

    const controller = new AbortController();
    aqAbortRef.current = controller;

    const cached = loadCachedAirQuality(profile.location);
    setAirQuality((prev) => ({
      ...prev,
      cachedData: cached,
      loading: true,
      error: null,
    }));

    try {
      const snapshot = await fetchLiveAirQuality(profile.location, controller.signal);
      if (controller.signal.aborted || aqRequestSeqRef.current !== requestSeq) {
        return;
      }
      setAirQuality({
        data: snapshot,
        cachedData: snapshot,
        loading: false,
        error: null,
      });
    } catch (err) {
      if ((err instanceof Error && err.name === 'AbortError') || controller.signal.aborted) {
        return;
      }
      if (aqRequestSeqRef.current !== requestSeq) {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Live air quality data is currently unavailable.';
      setAirQuality({
        data: null,
        cachedData: cached,
        loading: false,
        error: message,
      });
    }
  }, [profile.location]);

  useEffect(() => {
    void refreshAirQuality();
    return () => {
      aqAbortRef.current?.abort();
    };
  }, [refreshAirQuality]);

  const activeScale = useMemo(
    () => resolveActiveScale(profile.preferredScale, profile.location),
    [profile.preferredScale, profile.location]
  );

  const effectiveSnapshot = airQuality.data ?? airQuality.cachedData;
  const isShowingCachedData = !airQuality.data && Boolean(airQuality.cachedData);
  const isReadingStale = useMemo(
    () => (effectiveSnapshot ? isAirQualityStale(effectiveSnapshot.measuredAt) : false),
    [effectiveSnapshot]
  );

  const activeScaleReading = useMemo(() => {
    if (!effectiveSnapshot) return { value: null, dominantPollutant: null };
    return activeScale === 'IN_NAQI'
      ? effectiveSnapshot.scales.IN_NAQI
      : effectiveSnapshot.scales.US_EPA;
  }, [effectiveSnapshot, activeScale]);

  const activeAqiValue = activeScaleReading.value;
  const activeDominantPollutant = activeScaleReading.dominantPollutant;
  const activeCategory = useMemo(
    () => getAqiCategory(activeAqiValue, activeScale),
    [activeAqiValue, activeScale]
  );

  const generateRoutine = useCallback(async () => {
    setRoutineLoading(true);
    setRoutineError(null);
    try {
      const plan = await generateDailyRoutine({
        profile,
        airQuality: effectiveSnapshot,
        activeScale,
        language,
      });
      setRoutinePlan(plan);
      setCompletedRoutineIds([]);
    } catch (err) {
      setRoutineError(
        err instanceof Error ? err.message : 'Failed to generate personalized daily routine.'
      );
    } finally {
      setRoutineLoading(false);
    }
  }, [profile, effectiveSnapshot, activeScale, language, setRoutinePlan, setCompletedRoutineIds]);

  const toggleRoutineDone = useCallback(
    (id: string) => {
      setCompletedRoutineIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    },
    [setCompletedRoutineIds]
  );

  const toggleIndoorTask = useCallback(
    (id: string) => {
      setCompletedIndoorTasks((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    },
    [setCompletedIndoorTasks]
  );

  const addPurifierFilter = useCallback(
    (room: string, modelName: string, installedDate: string, intervalDays: number) => {
      setPurifierFilters((prev) => [
        ...prev,
        {
          id: `pf-${Date.now()}`,
          room,
          modelName,
          installedDate,
          intervalDays,
        },
      ]);
    },
    [setPurifierFilters]
  );

  const resetPurifierFilterDate = useCallback(
    (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      setPurifierFilters((prev) =>
        prev.map((f) => (f.id === id ? { ...f, installedDate: today } : f))
      );
    },
    [setPurifierFilters]
  );

  const removePurifierFilter = useCallback(
    (id: string) => {
      setPurifierFilters((prev) => prev.filter((f) => f.id !== id));
    },
    [setPurifierFilters]
  );

  const toggleCommitEco = useCallback(
    (id: string) => {
      setCommittedEcoIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    },
    [setCommittedEcoIds]
  );

  const toggleJoinCommunity = useCallback(
    (id: string) => {
      setJoinedCommunityIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    },
    [setJoinedCommunityIds]
  );

  const toggleCommunityStep = useCallback(
    (key: string) => {
      setCompletedCommunitySteps((prev) =>
        prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
      );
    },
    [setCompletedCommunitySteps]
  );

  const clearChat = useCallback(() => {
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: t('assistant.welcomeMessage'),
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [setChatMessages, t]);

  const updateNotificationSettings = useCallback(
    (patch: Partial<NotificationSettings>) => {
      setNotificationSettings((prev) => ({ ...prev, ...patch }));
    },
    [setNotificationSettings]
  );

  const dismissNotification = useCallback(
    (id: string) => {
      setDismissedNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [setDismissedNotificationIds]
  );

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      updateNotificationSettings({ browserNotifications: true });
      return true;
    }
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    updateNotificationSettings({ browserNotifications: granted });
    return granted;
  }, [updateNotificationSettings]);

  // Compute data-driven notifications strictly from actual live measurements & user trackers
  const notifications = useMemo<AppNotification[]>(() => {
    if (!notificationSettings.enabled) return [];
    const list: AppNotification[] = [];
    const nowIso = new Date().toISOString();

    if (airQuality.data && activeAqiValue !== null) {
      if (activeAqiValue >= notificationSettings.aqiAlertThreshold) {
        const bandLabel = t(activeCategory.labelKey);
        const scaleLabel = t(`scale.${activeScale}`);
        list.push({
          id: `aqi-threshold-${Math.floor(activeAqiValue / 25)}`,
          type: 'aqi',
          severity: activeAqiValue >= 300 ? 'critical' : 'warning',
          title: t('notifications.aqiTitle', { aqi: activeAqiValue, label: bandLabel }),
          message: t('notifications.aqiMessage', {
            location: profile.location?.name || t('notifications.yourArea'),
            aqi: activeAqiValue,
            scale: scaleLabel,
          }),
          timestamp: airQuality.data.measuredAt,
          actionTab: 'air-quality',
        });
      }

      if (notificationSettings.poorExerciseAlerts && !activeCategory.exerciseSafe) {
        list.push({
          id: `exercise-${activeCategory.band}`,
          type: 'exercise',
          severity: 'warning',
          title: t('notifications.exerciseTitle'),
          message: t('notifications.exerciseMessage'),
          timestamp: airQuality.data.measuredAt,
          actionTab: 'planner',
        });
      }

      if (notificationSettings.ventilationWindowAlerts && activeCategory.ventilationRecommended) {
        list.push({
          id: `vent-open-${activeCategory.band}`,
          type: 'ventilation',
          severity: 'positive',
          title: t('notifications.ventTitle'),
          message: t('notifications.ventMessage'),
          timestamp: airQuality.data.measuredAt,
          actionTab: 'indoor-air',
        });
      }

      if (notificationSettings.weatherChangeAlerts) {
        const dispersion = analyzeAtmosphericDispersion(airQuality.data.weather, language);
        if (dispersion.status === 'stagnant') {
          list.push({
            id: 'weather-stagnation',
            type: 'weather',
            severity: 'warning',
            title: dispersion.label,
            message: dispersion.summary,
            timestamp: airQuality.data.measuredAt,
            actionTab: 'air-quality',
          });
        }
      }
    }

    if (notificationSettings.purifierFilterReminders) {
      const todayMs = Date.now();
      for (const filter of purifierFilters) {
        const installedMs = new Date(filter.installedDate).getTime();
        if (!Number.isNaN(installedMs)) {
          const daysElapsed = Math.floor((todayMs - installedMs) / (1000 * 60 * 60 * 24));
          if (daysElapsed >= filter.intervalDays) {
            list.push({
              id: `filter-due-${filter.id}`,
              type: 'filter',
              severity: 'warning',
              title: t('notifications.filterTitle', { room: filter.room }),
              message: t('notifications.filterMessage', {
                model: filter.modelName,
                days: daysElapsed,
                target: filter.intervalDays,
              }),
              timestamp: nowIso,
              actionTab: 'indoor-air',
            });
          }
        }
      }
    }

    if (notificationSettings.dailyEcoReminders && committedEcoIds.length === 0) {
      list.push({
        id: 'eco-commit-reminder',
        type: 'eco',
        severity: 'info',
        title: t('notifications.ecoTitle'),
        message: t('notifications.ecoMessage'),
        timestamp: nowIso,
        actionTab: 'eco-alternatives',
      });
    }

    return list.filter((n) => !dismissedNotificationIds.includes(n.id));
  }, [
    notificationSettings,
    airQuality.data,
    activeAqiValue,
    activeCategory,
    activeScale,
    profile.location?.name,
    purifierFilters,
    committedEcoIds.length,
    dismissedNotificationIds,
    language,
    t,
  ]);

  // Fire native browser notification only when explicitly permitted and enabled
  useEffect(() => {
    if (
      !notificationSettings.enabled ||
      !notificationSettings.browserNotifications ||
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    const critical = notifications.find((n) => n.severity === 'critical');
    if (critical) {
      try {
        new Notification(`HAWA JANO — ${critical.title}`, {
          body: critical.message,
        });
      } catch {
        // Ignore browser notification constraints inside iframes
      }
    }
  }, [notifications, notificationSettings.enabled, notificationSettings.browserNotifications]);

  const resetAllLocalData = useCallback(() => {
    const keys = [
      'airwise_user_profile_v1',
      'airwise_last_aq_snapshot_v1',
      'airwise_daily_routine_v1',
      'airwise_completed_routine_v1',
      'airwise_indoor_tasks_v1',
      'airwise_purifier_filters_v1',
      'airwise_committed_eco_v1',
      'airwise_joined_community_v1',
      'airwise_community_steps_v1',
      'airwise_chat_history_v1',
      'airwise_notification_settings_v1',
      'airwise_dismissed_notifications_v1',
    ];
    keys.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
    setProfile(DEFAULT_PROFILE);
    setAirQuality({ data: null, cachedData: null, loading: false, error: null });
    setRoutinePlan(null);
    setCompletedRoutineIds([]);
    setCompletedIndoorTasks([]);
    setPurifierFilters([]);
    setCommittedEcoIds([]);
    setJoinedCommunityIds([]);
    setCompletedCommunitySteps([]);
    setChatMessages([INITIAL_ASSISTANT_MESSAGE]);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setDismissedNotificationIds([]);
  }, [
    setProfile,
    setRoutinePlan,
    setCompletedRoutineIds,
    setCompletedIndoorTasks,
    setPurifierFilters,
    setCommittedEcoIds,
    setJoinedCommunityIds,
    setCompletedCommunitySteps,
    setChatMessages,
    setNotificationSettings,
    setDismissedNotificationIds,
  ]);

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      toggleTheme,
      language,
      setLanguage,
      activeTab,
      setActiveTab,
      profile,
      updateProfile,
      setLocation,
      resetAllLocalData,
      airQuality,
      refreshAirQuality,
      activeScale,
      activeAqiValue,
      activeDominantPollutant,
      activeCategory,
      effectiveSnapshot,
      isShowingCachedData,
      isReadingStale,
      routinePlan,
      routineLoading,
      routineError,
      generateRoutine,
      completedRoutineIds,
      toggleRoutineDone,
      completedIndoorTasks,
      toggleIndoorTask,
      purifierFilters,
      addPurifierFilter,
      resetPurifierFilterDate,
      removePurifierFilter,
      committedEcoIds,
      toggleCommitEco,
      joinedCommunityIds,
      toggleJoinCommunity,
      completedCommunitySteps,
      toggleCommunityStep,
      chatMessages,
      setChatMessages,
      clearChat,
      notificationSettings,
      updateNotificationSettings,
      notifications,
      dismissedNotificationIds,
      dismissNotification,
      requestBrowserNotificationPermission,
      isLocationModalOpen,
      setIsLocationModalOpen,
      isProfileModalOpen,
      setIsProfileModalOpen,
      isNotificationsOpen,
      setIsNotificationsOpen,
    }),
    [
      theme,
      toggleTheme,
      language,
      setLanguage,
      activeTab,
      profile,
      updateProfile,
      setLocation,
      resetAllLocalData,
      airQuality,
      refreshAirQuality,
      activeScale,
      activeAqiValue,
      activeDominantPollutant,
      activeCategory,
      effectiveSnapshot,
      isShowingCachedData,
      isReadingStale,
      routinePlan,
      routineLoading,
      routineError,
      generateRoutine,
      completedRoutineIds,
      toggleRoutineDone,
      completedIndoorTasks,
      toggleIndoorTask,
      purifierFilters,
      addPurifierFilter,
      resetPurifierFilterDate,
      removePurifierFilter,
      committedEcoIds,
      toggleCommitEco,
      joinedCommunityIds,
      toggleJoinCommunity,
      completedCommunitySteps,
      toggleCommunityStep,
      chatMessages,
      setChatMessages,
      clearChat,
      notificationSettings,
      updateNotificationSettings,
      notifications,
      dismissedNotificationIds,
      dismissNotification,
      requestBrowserNotificationPermission,
      isLocationModalOpen,
      isProfileModalOpen,
      isNotificationsOpen,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
