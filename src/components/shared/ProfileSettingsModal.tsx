import React, { useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import type {
  AqiScale,
  BudgetPreference,
  CommuteMode,
  DietPreference,
  LifestyleRole,
  SupportedLanguage,
} from '../../types';

export const ProfileSettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    isProfileModalOpen,
    setIsProfileModalOpen,
    profile,
    updateProfile,
    setIsLocationModalOpen,
    resetAllLocalData,
    language,
    setLanguage,
  } = useApp();

  useEffect(() => {
    if (!isProfileModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isProfileModalOpen, setIsProfileModalOpen]);

  if (!isProfileModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsProfileModalOpen(false);
        }
      }}
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0E131B] border border-[#080808] dark:border-[#222B3A] border-t-2 border-t-blue-600 dark:border-t-blue-400 p-6">
        <div className="flex items-start justify-between border-b border-[#DADADA] dark:border-[#222B3A] pb-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {t('modals.profileKicker')}
            </p>
            <h2
              id="profile-modal-title"
              className="text-xl font-bold text-[#080808] dark:text-white mt-1"
            >
              {t('modals.profileTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(false)}
            className="p-2 border border-[#DADADA] dark:border-[#222B3A] hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]"
            aria-label="Close profile settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div className="p-3.5 border border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('modals.activeLocation')}
              </div>
              <div className="text-sm font-semibold">
                {profile.location ? profile.location.name : t('assistant.noLocation')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsProfileModalOpen(false);
                setIsLocationModalOpen(true);
              }}
              className="px-3 py-1.5 border border-[#080808] dark:border-white text-xs font-medium"
            >
              {t('nav.changeLocation')}
            </button>
          </div>

          <div className="p-3.5 border border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between gap-3">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {t('nav.languageLabel')}
            </div>
            <div className="flex border border-[#DADADA] dark:border-[#222B3A]">
              {(['en', 'hi'] as SupportedLanguage[]).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  onClick={() => setLanguage(lng)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    language === lng
                      ? lng === 'en'
                        ? 'bg-blue-600 text-white'
                        : 'bg-orange-600 text-white'
                      : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                  }`}
                >
                  {lng === 'en' ? 'English' : 'हिन्दी (Hindi)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="profile-preferred-scale"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-slate-400 mb-1.5"
              >
                {t('modals.preferredScale')}
              </label>
              <select
                id="profile-preferred-scale"
                value={profile.preferredScale}
                onChange={(e) =>
                  updateProfile({ preferredScale: e.target.value as 'auto' | AqiScale })
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
              >
                <option value="auto">{t('scale.autoOption')}</option>
                <option value="IN_NAQI">{t('scale.IN_NAQI')}</option>
                <option value="US_EPA">{t('scale.US_EPA')}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-lifestyle-role"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-slate-400 mb-1.5"
              >
                {t('modals.lifestyleRole')}
              </label>
              <select
                id="profile-lifestyle-role"
                value={profile.lifestyle}
                onChange={(e) => updateProfile({ lifestyle: e.target.value as LifestyleRole })}
                className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
              >
                <option value="parent">{t('onboarding.lifestyles.parent')}</option>
                <option value="office-worker">{t('onboarding.lifestyles.office-worker')}</option>
                <option value="student">{t('onboarding.lifestyles.student')}</option>
                <option value="outdoor-worker">{t('onboarding.lifestyles.outdoor-worker')}</option>
                <option value="elderly">{t('onboarding.lifestyles.elderly')}</option>
                <option value="work-from-home">{t('onboarding.lifestyles.work-from-home')}</option>
                <option value="other">{t('onboarding.lifestyles.other')}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-commute-mode"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-slate-400 mb-1.5"
              >
                {t('modals.commuteMode')}
              </label>
              <select
                id="profile-commute-mode"
                value={profile.preferences.commuteMode}
                onChange={(e) =>
                  updateProfile((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      commuteMode: e.target.value as CommuteMode,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
              >
                <option value="walk-cycle">{t('onboarding.commutes.walk-cycle')}</option>
                <option value="public-transport">{t('onboarding.commutes.public-transport')}</option>
                <option value="private-vehicle">{t('onboarding.commutes.private-vehicle')}</option>
                <option value="wfh">{t('onboarding.commutes.wfh')}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-budget-pref"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-slate-400 mb-1.5"
              >
                {t('modals.budgetPref')}
              </label>
              <select
                id="profile-budget-pref"
                value={profile.preferences.budget}
                onChange={(e) =>
                  updateProfile((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      budget: e.target.value as BudgetPreference,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
              >
                <option value="zero-low">{t('onboarding.budgets.zero-low')}</option>
                <option value="moderate">{t('onboarding.budgets.moderate')}</option>
                <option value="flexible">{t('onboarding.budgets.flexible')}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-food-pref"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-slate-400 mb-1.5"
              >
                {t('modals.foodPref')}
              </label>
              <select
                id="profile-food-pref"
                value={profile.preferences.diet}
                onChange={(e) =>
                  updateProfile((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      diet: e.target.value as DietPreference,
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] text-sm"
              >
                <option value="vegetarian">{t('onboarding.diets.vegetarian')}</option>
                <option value="non-vegetarian">{t('onboarding.diets.non-vegetarian')}</option>
                <option value="flexible">{t('onboarding.diets.flexible')}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="profile-family-members"
                className="block text-xs font-mono uppercase tracking-wider text-neutral-600 dark:text-slate-400 mb-1.5"
              >
                {t('modals.familyMembers')}
              </label>
              <input
                id="profile-family-members"
                type="number"
                min={1}
                max={20}
                value={profile.household.familyMembers}
                onChange={(e) =>
                  updateProfile((prev) => ({
                    ...prev,
                    household: {
                      ...prev.household,
                      familyMembers: Math.max(1, Number(e.target.value) || 1),
                    },
                  }))
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#151C28] border border-[#DADADA] dark:border-[#222B3A] font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: t('onboarding.hasChildren'),
                active: profile.household.hasChildren,
                key: 'hasChildren' as const,
              },
              {
                label: t('onboarding.hasElderly'),
                active: profile.household.hasElderly,
                key: 'hasElderly' as const,
              },
              {
                label: t('onboarding.hasPets'),
                active: profile.household.hasPets,
                key: 'hasPets' as const,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  updateProfile((prev) => ({
                    ...prev,
                    household: {
                      ...prev.household,
                      [item.key]: !prev.household[item.key],
                    },
                  }))
                }
                className={`p-2.5 border text-xs font-medium flex items-center justify-between gap-2 ${
                  item.active
                    ? 'border-[#080808] dark:border-white bg-[#F3F3F3] dark:bg-[#151C28]'
                    : 'border-[#DADADA] dark:border-[#222B3A]'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="font-mono shrink-0">
                  {item.active ? t('common.yes') : t('common.no')}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                resetAllLocalData();
                setIsProfileModalOpen(false);
              }}
              className="px-3 py-2 border border-red-600 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('modals.resetData')}
            </button>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="px-5 py-2 bg-[#080808] text-white dark:bg-white dark:text-[#080808] text-sm font-semibold"
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
