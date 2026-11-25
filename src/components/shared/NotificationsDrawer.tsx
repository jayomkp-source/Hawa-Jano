import React, { useCallback } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../contexts/AppContext';
import { useModalFocus } from '../../hooks/useModalFocus';
import { formatTimestamp } from '../../utils/aqi';

export const NotificationsDrawer: React.FC = () => {
  const { t } = useTranslation();
  const {
    isNotificationsOpen,
    setIsNotificationsOpen,
    notifications,
    dismissNotification,
    notificationSettings,
    updateNotificationSettings,
    requestBrowserNotificationPermission,
    setActiveTab,
  } = useApp();

  const closeDrawer = useCallback(() => setIsNotificationsOpen(false), [setIsNotificationsOpen]);
  const drawerRef = useModalFocus<HTMLDivElement>(isNotificationsOpen, closeDrawer);

  if (!isNotificationsOpen) return null;

  const severityStyles: Record<string, string> = {
    critical: 'border-red-600 text-red-700 dark:text-red-300',
    warning: 'border-orange-500 text-orange-700 dark:text-orange-300',
    positive: 'border-green-600 text-green-700 dark:text-green-300',
    info: 'border-blue-600 text-blue-700 dark:text-blue-300',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsNotificationsOpen(false);
        }
      }}
    >
      <div
        ref={drawerRef}
        tabIndex={-1}
        className="w-full max-w-md h-full bg-white dark:bg-[#0B0F17] border-l border-[#DADADA] dark:border-[#222B3A] flex flex-col focus:outline-none"
      >
        <div className="p-5 border-b border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 id="notifications-drawer-title" className="text-base font-bold">
              {t('modals.alertsTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsNotificationsOpen(false)}
            className="p-2 border border-[#DADADA] dark:border-[#222B3A] hover:bg-[#F3F3F3] dark:hover:bg-[#151C28]"
            aria-label="Close alerts drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                {t('modals.activeAlerts', { count: notifications.length })}
              </h3>
            </div>

            {notifications.length === 0 ? (
              <div className="p-4 border border-[#DADADA] dark:border-[#222B3A] text-xs text-neutral-500 dark:text-neutral-400">
                {t('modals.noAlerts')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 border bg-white dark:bg-[#0E131B] ${
                      severityStyles[n.severity] || 'border-[#DADADA]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-[#080808] dark:text-white">
                        {n.title}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissNotification(n.id)}
                        className="text-xs text-neutral-500 hover:text-[#080808] dark:hover:text-white shrink-0"
                        aria-label={`Dismiss ${n.title}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-neutral-500">
                      <span>{formatTimestamp(n.timestamp)}</span>
                      {n.actionTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab(n.actionTab!);
                            setIsNotificationsOpen(false);
                          }}
                          className="underline text-[#080808] dark:text-white font-sans font-medium"
                        >
                          {t('modals.openSection')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#DADADA] dark:border-[#222B3A] pt-5 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-500">
              {t('modals.configurableRules')}
            </h3>

            <div className="p-3 border border-[#DADADA] dark:border-[#222B3A] flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{t('modals.enableAlerts')}</div>
                <div className="text-xs text-neutral-500">{t('modals.enableAlertsDesc')}</div>
              </div>
              <button
                type="button"
                aria-pressed={notificationSettings.enabled}
                aria-label={`${t('modals.enableAlerts')}: ${notificationSettings.enabled ? t('common.on') : t('common.off')}`}
                onClick={() => updateNotificationSettings({ enabled: !notificationSettings.enabled })}
                className={`px-3 py-1 text-xs font-mono border ${
                  notificationSettings.enabled
                    ? 'bg-[#080808] text-white dark:bg-white dark:text-[#080808] border-[#080808] dark:border-white'
                    : 'border-[#DADADA] dark:border-[#222B3A]'
                }`}
              >
                {notificationSettings.enabled ? t('common.on') : t('common.off')}
              </button>
            </div>

            <div className="p-3 border border-[#DADADA] dark:border-[#222B3A] space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="aqi-threshold-select" className="text-sm font-medium">
                  {t('modals.aqiThreshold')}
                </label>
                <span className="font-mono text-xs font-semibold">
                  ≥ {notificationSettings.aqiAlertThreshold}
                </span>
              </div>
              <select
                id="aqi-threshold-select"
                value={notificationSettings.aqiAlertThreshold}
                onChange={(e) =>
                  updateNotificationSettings({ aqiAlertThreshold: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#0E131B] border border-[#DADADA] dark:border-[#222B3A] text-xs"
              >
                <option value={100}>100+</option>
                <option value={150}>150+</option>
                <option value={200}>200+</option>
                <option value={300}>300+</option>
              </select>
            </div>

            {[
              {
                key: 'poorExerciseAlerts' as const,
                label: t('modals.rules.poorExerciseAlerts'),
              },
              {
                key: 'ventilationWindowAlerts' as const,
                label: t('modals.rules.ventilationWindowAlerts'),
              },
              {
                key: 'purifierFilterReminders' as const,
                label: t('modals.rules.purifierFilterReminders'),
              },
              {
                key: 'weatherChangeAlerts' as const,
                label: t('modals.rules.weatherChangeAlerts'),
              },
              {
                key: 'dailyEcoReminders' as const,
                label: t('modals.rules.dailyEcoReminders'),
              },
            ].map((item) => {
              const active = notificationSettings[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-2 border-b border-[#DADADA] dark:border-[#222B3A]"
                >
                  <span className="text-sm">{item.label}</span>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`${item.label}: ${active ? t('common.on') : t('common.off')}`}
                    onClick={() => updateNotificationSettings({ [item.key]: !active })}
                    className={`px-2.5 py-1 text-xs font-mono border ${
                      active
                        ? 'bg-[#080808] text-white dark:bg-white dark:text-[#080808] border-[#080808] dark:border-white'
                        : 'border-[#DADADA] dark:border-[#222B3A] text-neutral-500'
                    }`}
                  >
                    {active ? t('common.on') : t('common.off')}
                  </button>
                </div>
              );
            })}

            <div className="p-3.5 bg-[#F3F3F3] dark:bg-[#0E131B] border border-[#DADADA] dark:border-[#222B3A] space-y-2">
              <div className="text-xs font-semibold">{t('modals.browserPushTitle')}</div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('modals.browserPushDesc')}
              </p>
              <button
                type="button"
                onClick={() => void requestBrowserNotificationPermission()}
                className="w-full py-2 border border-[#080808] dark:border-white text-xs font-medium hover:bg-white dark:hover:bg-[#141414]"
              >
                {notificationSettings.browserNotifications
                  ? t('modals.browserPushEnabled')
                  : t('modals.browserPushAllow')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
