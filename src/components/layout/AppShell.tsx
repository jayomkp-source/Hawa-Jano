import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  CalendarCheck,
  Home,
  Languages,
  LayoutDashboard,
  Leaf,
  MapPin,
  Menu,
  Moon,
  Sparkles,
  Sun,
  User,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import type { NavTab } from '../../types';

const NAV_ITEMS: Array<{
  id: NavTab;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  badgeClass: string;
  activeTabClass: string;
  activeDotClass: string;
}> = [
  {
    id: 'overview',
    labelKey: 'nav.overview',
    icon: LayoutDashboard,
    iconColor: 'text-sky-600 dark:text-sky-400',
    badgeClass: 'bg-sky-50 border-sky-200 dark:bg-sky-950/50 dark:border-sky-800/70',
    activeTabClass:
      'bg-sky-50/90 text-[#080808] border-sky-600 dark:bg-sky-950/60 dark:text-white dark:border-sky-400',
    activeDotClass: 'bg-sky-600 dark:bg-sky-400',
  },
  {
    id: 'air-quality',
    labelKey: 'nav.airQuality',
    icon: Activity,
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeClass: 'bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800/70',
    activeTabClass:
      'bg-orange-50/90 text-[#080808] border-orange-600 dark:bg-orange-950/60 dark:text-white dark:border-orange-400',
    activeDotClass: 'bg-orange-600 dark:bg-orange-400',
  },
  {
    id: 'planner',
    labelKey: 'nav.planner',
    icon: CalendarCheck,
    iconColor: 'text-blue-600 dark:text-blue-400',
    badgeClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800/70',
    activeTabClass:
      'bg-blue-50/90 text-[#080808] border-blue-600 dark:bg-blue-950/60 dark:text-white dark:border-blue-400',
    activeDotClass: 'bg-blue-600 dark:bg-blue-400',
  },
  {
    id: 'indoor-air',
    labelKey: 'nav.indoorAir',
    icon: Home,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badgeClass: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/50 dark:border-cyan-800/70',
    activeTabClass:
      'bg-cyan-50/90 text-[#080808] border-cyan-600 dark:bg-cyan-950/60 dark:text-white dark:border-cyan-400',
    activeDotClass: 'bg-cyan-600 dark:bg-cyan-400',
  },
  {
    id: 'eco-alternatives',
    labelKey: 'nav.ecoAlternatives',
    icon: Leaf,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800/70',
    activeTabClass:
      'bg-emerald-50/90 text-[#080808] border-emerald-600 dark:bg-emerald-950/60 dark:text-white dark:border-emerald-400',
    activeDotClass: 'bg-emerald-600 dark:bg-emerald-400',
  },
  {
    id: 'community',
    labelKey: 'nav.community',
    icon: Users,
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800/70',
    activeTabClass:
      'bg-amber-50/90 text-[#080808] border-amber-600 dark:bg-amber-950/60 dark:text-white dark:border-amber-400',
    activeDotClass: 'bg-amber-600 dark:bg-amber-400',
  },
  {
    id: 'assistant',
    labelKey: 'nav.assistant',
    icon: Sparkles,
    iconColor: 'text-purple-600 dark:text-purple-400',
    badgeClass: 'bg-purple-50 border-purple-200 dark:bg-purple-950/50 dark:border-purple-800/70',
    activeTabClass:
      'bg-purple-50/90 text-[#080808] border-purple-600 dark:bg-purple-950/60 dark:text-white dark:border-purple-400',
    activeDotClass: 'bg-purple-600 dark:bg-purple-400',
  },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const {
    theme,
    toggleTheme,
    language,
    setLanguage,
    activeTab,
    setActiveTab,
    profile,
    activeScale,
    activeAqiValue,
    activeCategory,
    notifications,
    setIsLocationModalOpen,
    setIsProfileModalOpen,
    setIsNotificationsOpen,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#070A0F] text-[#080808] dark:text-[#F8FAFC] flex flex-col lg:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#080808] focus:text-white dark:focus:bg-white dark:focus:text-[#080808] focus:text-xs focus:font-semibold"
      >
        {t('common.skipToContent')}
      </a>
      {/* Desktop Sharp Vertical Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0B0F17] lg:sticky lg:top-0 lg:h-screen">
        <div className="p-5 border-b border-[#DADADA] dark:border-[#222B3A] flex items-center gap-3">
          <div className="w-9 h-9 bg-[#080808] dark:bg-[#151C28] border border-[#080808] dark:border-cyan-500/40 text-white flex items-center justify-center shrink-0">
            <Wind className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-extrabold tracking-tight text-base leading-none">
              {t('brand.name')}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-slate-400 mt-1 truncate">
              {t('brand.tagline')}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 text-sm font-medium border transition-colors whitespace-nowrap ${
                  isActive
                    ? `${item.activeTabClass} font-semibold`
                    : 'border-transparent text-[#080808] dark:text-slate-200 hover:bg-[#F3F3F3] dark:hover:bg-[#151C28] hover:border-[#DADADA] dark:hover:border-[#222B3A]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-7 h-7 border flex items-center justify-center shrink-0 ${item.badgeClass}`}
                  >
                    <Icon className={`w-4 h-4 ${item.iconColor}`} />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </span>
                {isActive && <span className={`w-1.5 h-4 shrink-0 ${item.activeDotClass}`} />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#DADADA] dark:border-[#222B3A] space-y-2.5">
          <button
            type="button"
            onClick={() => handleNavClick('assistant')}
            className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {t('nav.askAi')}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="py-2 px-2.5 border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#151C28] text-xs font-medium flex items-center justify-center gap-1.5 hover:border-[#080808] dark:hover:border-cyan-400 transition-colors"
              aria-label={`${theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')} — Toggle color theme`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  {t('nav.darkMode')}
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  {t('nav.lightMode')}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="py-2 px-2.5 border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#151C28] text-xs font-medium flex items-center justify-center gap-1.5 hover:border-[#080808] dark:hover:border-blue-400 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {t('nav.profile')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-[#0B0F17] border-b border-[#DADADA] dark:border-[#222B3A] px-4 lg:px-8 h-14 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Mobile menu + Location selector */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 border border-[#DADADA] dark:border-[#222B3A] hover:border-[#080808] dark:hover:border-cyan-400"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </button>

            <span className="lg:hidden font-display font-bold text-sm tracking-tight whitespace-nowrap shrink-0">
              {t('brand.name')}
            </span>

            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#111723] hover:border-blue-600 dark:hover:border-blue-400 text-xs min-w-0 transition-colors"
              aria-label={`${profile.location ? profile.location.name : t('nav.selectLocation')} — ${t('nav.changeLocation')}`}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[200px] font-medium">
                {profile.location ? profile.location.name : t('nav.selectLocation')}
              </span>
            </button>
          </div>

          {/* Right: Language Switcher, Theme Toggle, Live AQI Readout, Notifications, Profile, AI Button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Sharp EN | हिन्दी Language Toggle */}
            <div
              className="flex border border-[#DADADA] dark:border-[#222B3A]"
              role="group"
              aria-label={t('nav.languageLabel')}
            >
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1.5 text-[11px] font-mono font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                }`}
                aria-pressed={language === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  language === 'hi'
                    ? 'bg-orange-600 text-white'
                    : 'hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                }`}
                aria-pressed={language === 'hi'}
              >
                हिन्दी
              </button>
            </div>

            {/* Direct Top Header Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#111723] hover:border-amber-500 dark:hover:border-amber-400 transition-colors flex items-center gap-1.5 text-xs font-medium"
              aria-label={`${theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')} — Toggle color theme`}
              title={theme === 'light' ? t('nav.darkModeFull') : t('nav.lightModeFull')}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              <span className="hidden xl:inline text-[11px]">
                {theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('air-quality')}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#111723] hover:border-[#080808] dark:hover:border-orange-400 text-xs whitespace-nowrap transition-colors"
            >
              <span
                className="w-2.5 h-2.5 shrink-0"
                style={{ backgroundColor: activeCategory.hex }}
                aria-hidden="true"
              />
              <span className="font-mono font-bold tabular-nums">
                {activeAqiValue !== null ? activeAqiValue : '—'}
              </span>
              <span className="text-neutral-500 dark:text-slate-400">
                {t(`scale.${activeScale}_SHORT`)} ·{' '}
                <span className={activeCategory.textColorClass}>
                  {t(activeCategory.shortLabelKey)}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#111723] hover:border-amber-600 dark:hover:border-amber-400 transition-colors"
              aria-label={
                notifications.length > 0
                  ? `${notifications.length} Notifications`
                  : 'Notifications'
              }
            >
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-orange-600 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="lg:hidden p-2 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#111723]"
              aria-label={t('nav.profile')}
            >
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('assistant')}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">{t('nav.assistant')}</span>
              <span className="sm:hidden">{t('nav.aiShort')}</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden flex bg-black/70"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div className="w-72 max-w-[85vw] bg-white dark:bg-[#0B0F17] border-r border-[#DADADA] dark:border-[#222B3A] flex flex-col h-full">
              <div className="p-4 border-b border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                  <span className="font-display font-bold">{t('brand.name')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 border border-[#DADADA] dark:border-[#222B3A]"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2.5 text-sm font-medium border ${
                        isActive
                          ? `${item.activeTabClass} font-semibold`
                          : 'border-transparent hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 border flex items-center justify-center shrink-0 ${item.badgeClass}`}
                        >
                          <Icon className={`w-4 h-4 ${item.iconColor}`} />
                        </span>
                        <span>{t(item.labelKey)}</span>
                      </span>
                      {isActive && <span className={`w-1.5 h-4 shrink-0 ${item.activeDotClass}`} />}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[#DADADA] dark:border-[#222B3A] space-y-2">
                <div className="flex items-center justify-between border border-[#DADADA] dark:border-[#222B3A] px-2.5 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    {t('nav.languageLabel')}
                  </span>
                  <div className="flex gap-1" role="group" aria-label={t('nav.languageLabel')}>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      aria-pressed={language === 'en'}
                      className={`px-2 py-0.5 font-mono ${
                        language === 'en' ? 'bg-blue-600 text-white' : ''
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('hi')}
                      aria-pressed={language === 'hi'}
                      className={`px-2 py-0.5 ${
                        language === 'hi' ? 'bg-orange-600 text-white' : ''
                      }`}
                    >
                      हिन्दी
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex-1 py-2 border border-[#DADADA] dark:border-[#222B3A] text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    {theme === 'light' ? (
                      <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    {theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="flex-1 py-2 border border-[#DADADA] dark:border-[#222B3A] text-xs font-medium"
                  >
                    {t('nav.settings')}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
          </div>
        )}

        {/* Active Page Container */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
