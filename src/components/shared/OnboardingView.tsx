import React, { useState } from 'react';
import {
  ArrowRight,
  LocateFixed,
  Lock,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  Wind,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import {
  LOCATION_ERROR_MESSAGES,
  requestBrowserLocation,
  searchLocations,
} from '../../services/airQualityService';
import type {
  BudgetPreference,
  CommuteMode,
  DietPreference,
  GeocodeResult,
  LifestyleRole,
  LocationData,
} from '../../types';

const LIFESTYLE_KEYS: LifestyleRole[] = [
  'parent',
  'office-worker',
  'student',
  'outdoor-worker',
  'elderly',
  'work-from-home',
  'other',
];

export const OnboardingView: React.FC = () => {
  const { t } = useTranslation();
  const { profile, updateProfile, theme, toggleTheme, language, setLanguage } = useApp();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [location, setLocalLocation] = useState<LocationData | null>(profile.location);
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [lifestyle, setLifestyle] = useState<LifestyleRole>(profile.lifestyle);
  const [familyMembers, setFamilyMembers] = useState<number>(profile.household.familyMembers);
  const [hasChildren, setHasChildren] = useState<boolean>(profile.household.hasChildren);
  const [hasElderly, setHasElderly] = useState<boolean>(profile.household.hasElderly);
  const [hasPets, setHasPets] = useState<boolean>(profile.household.hasPets);
  const [outdoorActivity, setOutdoorActivity] = useState<'minimal' | 'light' | 'moderate' | 'high'>(
    profile.household.typicalOutdoorActivity
  );

  const [commuteMode, setCommuteMode] = useState<CommuteMode>(profile.preferences.commuteMode);
  const [diet, setDiet] = useState<DietPreference>(profile.preferences.diet);
  const [budget, setBudget] = useState<BudgetPreference>(profile.preferences.budget);

  const mapLocError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : '';
    if (msg === LOCATION_ERROR_MESSAGES.INVALID_PIN) return t('modals.invalidPin');
    if (msg === LOCATION_ERROR_MESSAGES.NETWORK) return t('modals.networkError');
    if (msg === LOCATION_ERROR_MESSAGES.LOCATION_SERVICE) return t('modals.locationSearchError');
    if (!msg || /unexpected token|is not valid json|<!doctype|<html/i.test(msg)) {
      return t('modals.locationSearchError');
    }
    return msg;
  };

  const handleGeolocation = async () => {
    setLocLoading(true);
    setLocError(null);
    try {
      const loc = await requestBrowserLocation();
      setLocalLocation(loc);
    } catch (err) {
      setLocError(mapLocError(err));
    } finally {
      setLocLoading(false);
    }
  };

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = cityQuery.trim();
    if (!trimmed || (/^\d+$/.test(trimmed) && !/^\d{6}$/.test(trimmed)) || trimmed.length < 2) {
      setSearchResults([]);
      setLocError(t('modals.invalidPin'));
      return;
    }
    setLocLoading(true);
    setLocError(null);
    try {
      const found = await searchLocations(trimmed);
      setSearchResults(found);
      if (found.length === 0) {
        setLocError(t('modals.noLocationMatch'));
      }
    } catch (err) {
      setSearchResults([]);
      setLocError(mapLocError(err));
    } finally {
      setLocLoading(false);
    }
  };

  const finishOnboarding = (skipToEnd = false) => {
    updateProfile({
      onboardingCompleted: true,
      location,
      lifestyle: skipToEnd ? profile.lifestyle : lifestyle,
      household: skipToEnd
        ? profile.household
        : {
            familyMembers,
            hasChildren,
            hasElderly,
            hasPets,
            typicalOutdoorActivity: outdoorActivity,
          },
      preferences: skipToEnd
        ? profile.preferences
        : {
            commuteMode,
            diet,
            budget,
          },
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#070A0F] text-[#080808] dark:text-[#F8FAFC] flex flex-col">
      <header className="border-b border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0B0F17] px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-600 text-white flex items-center justify-center">
            <Wind className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-display font-bold tracking-tight text-lg">{t('brand.name')}</span>
            <span className="hidden sm:inline text-xs text-neutral-500 dark:text-neutral-400 ml-3">
              {t('brand.tagline')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-[#DADADA] dark:border-[#222B3A]">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-1.5 text-xs font-mono ${
                language === 'en' ? 'bg-blue-600 text-white' : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-2 py-1.5 text-xs ${
                language === 'hi' ? 'bg-orange-600 text-white' : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
              }`}
            >
              हिन्दी
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="px-3 py-1.5 text-xs font-medium border border-[#DADADA] dark:border-[#222B3A] hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] flex items-center gap-1.5"
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            )}
            {theme === 'light' ? t('nav.darkModeFull') : t('nav.lightModeFull')}
          </button>
          <button
            type="button"
            onClick={() => finishOnboarding(true)}
            className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-[#080808] dark:hover:text-white"
          >
            {t('onboarding.skipSetup')}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl border border-[#DADADA] dark:border-[#222B3A] border-t-2 border-t-cyan-600 dark:border-t-cyan-400 bg-white dark:bg-[#0E131B] p-6 sm:p-10">
          {/* Step Progress Bar */}
          <div className="grid grid-cols-4 gap-2 mb-8">
            {[
              { num: 1, label: t('onboarding.step1Label'), bar: 'bg-sky-500' },
              { num: 2, label: t('onboarding.step2Label'), bar: 'bg-blue-500' },
              { num: 3, label: t('onboarding.step3Label'), bar: 'bg-purple-500' },
              { num: 4, label: t('onboarding.step4Label'), bar: 'bg-emerald-500' },
            ].map((item) => (
              <div key={item.num} className="space-y-1.5">
                <div
                  className={`h-1.5 w-full ${
                    item.num <= step
                      ? item.bar
                      : 'bg-[#DADADA] dark:bg-[#222B3A]'
                  }`}
                />
                <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {t('onboarding.step1Title')}
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 leading-relaxed">
                  {t('onboarding.step1Desc')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGeolocation}
                disabled={locLoading}
                className="w-full py-3 px-4 bg-[#080808] text-white dark:bg-white dark:text-[#080808] text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                <LocateFixed className="w-4 h-4 text-cyan-400 dark:text-cyan-600" />
                {locLoading ? t('onboarding.detectingGps') : t('onboarding.detectGps')}
              </button>

              <form onSubmit={handleSearchCity} className="flex gap-2">
                <input
                  type="text"
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value);
                    if (locError) setLocError(null);
                  }}
                  placeholder={t('onboarding.searchPlaceholder')}
                  className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] focus:outline-none focus:border-[#080808] dark:focus:border-white"
                />
                <button
                  type="submit"
                  disabled={locLoading}
                  className="px-4 py-2.5 border border-[#080808] dark:border-white text-sm font-medium hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" />
                  {t('common.find')}
                </button>
              </form>

              {locError && (
                <div
                  role="alert"
                  className="p-3 border border-red-600 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300"
                >
                  {locError}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="border border-[#DADADA] dark:border-[#222B3A] divide-y divide-[#DADADA] dark:divide-[#2A2A2A] max-h-48 overflow-y-auto">
                  {searchResults.map((res, i) => {
                    const meta = [
                      res.district && res.district !== res.city ? res.district : '',
                      res.region || '',
                      res.country || '',
                      res.pinCode ? `PIN ${res.pinCode}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <button
                        key={`${res.latitude}-${res.longitude}-${i}`}
                        type="button"
                        onClick={() => {
                          setLocalLocation({
                            ...res,
                            source: 'manual',
                            updatedAt: new Date().toISOString(),
                          });
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <strong className="font-semibold block truncate">
                            {res.city || res.name}
                          </strong>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 block truncate">
                            {meta || '—'}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-neutral-500 shrink-0">
                          {t('common.select')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {location && (
                <div className="p-3.5 bg-[#F3F3F3] dark:bg-[#151C28] border border-green-600 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-green-700 dark:text-green-400">
                      {t('onboarding.selectedLocation')}
                    </div>
                    <div className="text-sm font-semibold">
                      {location.name}
                      {location.country ? ` · ${location.country}` : ''}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">
                    {location.countryCode === 'IN' ? t('scale.IN_NAQI_SHORT') : t('scale.US_EPA_SHORT')}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[#DADADA] dark:border-[#222B3A]">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-neutral-500 hover:text-[#080808] dark:hover:text-white"
                >
                  {t('onboarding.skipLocation')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-[#080808] text-white dark:bg-white dark:text-[#080808] text-sm font-semibold flex items-center gap-2"
                >
                  {t('common.continue')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {t('onboarding.step2Title')}
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  {t('onboarding.step2Desc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LIFESTYLE_KEYS.map((role) => {
                  const active = lifestyle === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setLifestyle(role)}
                      className={`text-left p-3.5 border transition-colors ${
                        active
                          ? 'border-[#080808] dark:border-white bg-[#F3F3F3] dark:bg-[#151C28]'
                          : 'border-[#DADADA] dark:border-[#222B3A] hover:border-[#080808] dark:hover:border-white'
                      }`}
                    >
                      <div className="text-sm font-semibold">{t(`onboarding.lifestyles.${role}`)}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {t(`onboarding.lifestyles.${role}Desc`)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#DADADA] dark:border-[#222B3A]">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-[#DADADA] dark:border-[#222B3A] text-sm"
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 bg-[#080808] text-white dark:bg-white dark:text-[#080808] text-sm font-semibold flex items-center gap-2"
                >
                  {t('common.continue')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  {t('onboarding.step3Title')}
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  {t('onboarding.step3Desc')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-[#DADADA] dark:border-[#222B3A] p-4">
                  <label
                    htmlFor="family-count"
                    className="block text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                  >
                    {t('onboarding.householdMembers')}
                  </label>
                  <input
                    id="family-count"
                    type="number"
                    min={1}
                    max={20}
                    value={familyMembers}
                    onChange={(e) => setFamilyMembers(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-2 w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] font-mono text-lg"
                  />
                </div>

                <div className="border border-[#DADADA] dark:border-[#222B3A] p-4">
                  <label
                    htmlFor="outdoor-activity"
                    className="block text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                  >
                    {t('onboarding.outdoorActivity')}
                  </label>
                  <select
                    id="outdoor-activity"
                    value={outdoorActivity}
                    onChange={(e) =>
                      setOutdoorActivity(
                        e.target.value as 'minimal' | 'light' | 'moderate' | 'high'
                      )
                    }
                    className="mt-2 w-full px-3 py-2.5 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
                  >
                    <option value="minimal">{t('onboarding.activityMinimal')}</option>
                    <option value="light">{t('onboarding.activityLight')}</option>
                    <option value="moderate">{t('onboarding.activityModerate')}</option>
                    <option value="high">{t('onboarding.activityHigh')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: t('onboarding.hasChildren'),
                    checked: hasChildren,
                    toggle: () => setHasChildren((v) => !v),
                  },
                  {
                    label: t('onboarding.hasElderly'),
                    checked: hasElderly,
                    toggle: () => setHasElderly((v) => !v),
                  },
                  {
                    label: t('onboarding.hasPets'),
                    checked: hasPets,
                    toggle: () => setHasPets((v) => !v),
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.toggle}
                    className={`p-3.5 border text-left text-sm font-medium ${
                      item.checked
                        ? 'border-[#080808] dark:border-white bg-[#F3F3F3] dark:bg-[#151C28]'
                        : 'border-[#DADADA] dark:border-[#222B3A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.label}</span>
                      <span className="font-mono text-xs shrink-0">
                        {item.checked ? t('common.yes') : t('common.no')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#DADADA] dark:border-[#222B3A]">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-[#DADADA] dark:border-[#222B3A] text-sm"
                >
                  {t('common.back')}
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-xs text-neutral-500 hover:text-[#080808] dark:hover:text-white"
                  >
                    {t('common.skip')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-5 py-2.5 bg-[#080808] text-white dark:bg-white dark:text-[#080808] text-sm font-semibold flex items-center gap-2"
                  >
                    {t('common.continue')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {t('onboarding.step4Title')}
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  {t('onboarding.step4Desc')}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2">
                    {t('onboarding.commuteRoutine')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['walk-cycle', 'public-transport', 'private-vehicle', 'wfh'] as CommuteMode[]).map(
                      (val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCommuteMode(val)}
                          className={`px-3 py-2.5 border text-xs font-medium ${
                            commuteMode === val
                              ? 'border-[#080808] dark:border-white bg-[#080808] text-white dark:bg-white dark:text-[#080808]'
                              : 'border-[#DADADA] dark:border-[#222B3A]'
                          }`}
                        >
                          {t(`onboarding.commutes.${val}`)}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2">
                      {t('onboarding.foodPreference')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['vegetarian', 'non-vegetarian', 'flexible'] as DietPreference[]).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDiet(val)}
                          className={`px-2 py-2 border text-xs font-medium ${
                            diet === val
                              ? 'border-[#080808] dark:border-white bg-[#080808] text-white dark:bg-white dark:text-[#080808]'
                              : 'border-[#DADADA] dark:border-[#222B3A]'
                          }`}
                        >
                          {t(`onboarding.diets.${val}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-500 mb-2">
                      {t('onboarding.budgetPreference')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['zero-low', 'moderate', 'flexible'] as BudgetPreference[]).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setBudget(val)}
                          className={`px-2 py-2 border text-xs font-medium ${
                            budget === val
                              ? 'border-[#080808] dark:border-white bg-[#080808] text-white dark:bg-white dark:text-[#080808]'
                              : 'border-[#DADADA] dark:border-[#222B3A]'
                          }`}
                        >
                          {t(`onboarding.budgets.${val}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#F3F3F3] dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] flex items-start gap-3">
                <Lock className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  <strong>{t('onboarding.privacyTitle')}</strong> {t('onboarding.privacyDesc')}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#DADADA] dark:border-[#222B3A]">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 border border-[#DADADA] dark:border-[#222B3A] text-sm"
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  onClick={() => finishOnboarding(false)}
                  className="px-5 py-2.5 bg-[#080808] text-white dark:bg-white dark:text-[#080808] text-sm font-semibold flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-green-400 dark:text-green-600" />
                  {t('onboarding.launchDashboard')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
