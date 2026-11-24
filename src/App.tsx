import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from './components/layout/AppShell';
import { LocationSelectorModal } from './components/shared/LocationSelectorModal';
import { NotificationsDrawer } from './components/shared/NotificationsDrawer';
import { OnboardingView } from './components/shared/OnboardingView';
import { ProfileSettingsModal } from './components/shared/ProfileSettingsModal';
import { AppProvider, useApp } from './contexts/AppContext';
import { Overview } from './pages/Overview';

const AirQuality = lazy(() =>
  import('./pages/AirQuality').then((m) => ({ default: m.AirQuality }))
);
const DailyPlanner = lazy(() =>
  import('./pages/DailyPlanner').then((m) => ({ default: m.DailyPlanner }))
);
const IndoorAir = lazy(() =>
  import('./pages/IndoorAir').then((m) => ({ default: m.IndoorAir }))
);
const EcoAlternatives = lazy(() =>
  import('./pages/EcoAlternatives').then((m) => ({ default: m.EcoAlternatives }))
);
const Community = lazy(() =>
  import('./pages/Community').then((m) => ({ default: m.Community }))
);
const Assistant = lazy(() =>
  import('./pages/Assistant').then((m) => ({ default: m.Assistant }))
);

const PageLoader: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="border border-[#DADADA] dark:border-[#2A2A2A] p-8 text-xs font-mono text-neutral-500">
      {t('common.loadingSection')}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { profile, activeTab } = useApp();

  if (!profile.onboardingCompleted) {
    return <OnboardingView />;
  }

  return (
    <>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'air-quality' && <AirQuality />}
          {activeTab === 'planner' && <DailyPlanner />}
          {activeTab === 'indoor-air' && <IndoorAir />}
          {activeTab === 'eco-alternatives' && <EcoAlternatives />}
          {activeTab === 'community' && <Community />}
          {activeTab === 'assistant' && <Assistant />}
        </Suspense>
      </AppShell>

      <LocationSelectorModal />
      <ProfileSettingsModal />
      <NotificationsDrawer />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
