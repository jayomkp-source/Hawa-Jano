import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CloudSun,
  Droplets,
  Languages,
  MapPin,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  Thermometer,
  Trash2,
  Wind,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { streamAssistantChat } from '../services/geminiService';
import type { ChatMessage } from '../types';

function renderInlineFormatting(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return (
        <strong key={i} className="font-semibold text-[#080808] dark:text-white">
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{seg}</React.Fragment>;
  });
}

function FormattedAssistantMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (/^#{1,3}\s+/.test(line)) {
          const clean = line.replace(/^#{1,3}\s+/, '');
          return (
            <div
              key={idx}
              className="font-display font-bold text-sm text-[#080808] dark:text-cyan-300 pt-1"
            >
              {renderInlineFormatting(clean)}
            </div>
          );
        }
        if (/^[-*•]\s+/.test(line)) {
          const body = line.replace(/^[-*•]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1.5 h-1.5 bg-purple-600 dark:bg-cyan-400 mt-2 shrink-0" />
              <span>{renderInlineFormatting(body)}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5 shrink-0">
                  {match[1]}
                </span>
                <span>{renderInlineFormatting(match[2])}</span>
              </div>
            );
          }
        }
        return <p key={idx}>{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

const PROMPT_ICONS = [
  { Icon: CloudSun, color: 'text-amber-500 dark:text-amber-400' },
  { Icon: Activity, color: 'text-orange-600 dark:text-orange-400' },
  { Icon: MapPin, color: 'text-blue-600 dark:text-blue-400' },
  { Icon: Wind, color: 'text-cyan-600 dark:text-cyan-400' },
  { Icon: ShieldAlert, color: 'text-emerald-600 dark:text-emerald-400' },
  { Icon: Languages, color: 'text-purple-600 dark:text-purple-400' },
];

export const Assistant: React.FC = () => {
  const { t } = useTranslation();
  const {
    language,
    profile,
    activeScale,
    activeAqiValue,
    activeCategory,
    effectiveSnapshot,
    chatMessages,
    setChatMessages,
    clearChat,
  } = useApp();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const suggestedPrompts = t('assistant.prompts', { returnObjects: true }) as string[];

  useEffect(() => {
    if (
      chatMessages.length === 1 &&
      chatMessages[0].role === 'assistant' &&
      chatMessages[0].id.startsWith('welcome')
    ) {
      const translatedWelcome = t('assistant.welcomeMessage');
      if (chatMessages[0].content !== translatedWelcome) {
        setChatMessages([
          {
            ...chatMessages[0],
            content: translatedWelcome,
          },
        ]);
      }
    }
  }, [language, chatMessages, setChatMessages, t]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [chatMessages, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const assistantId = `assistant-${Date.now() + 1}`;
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    // Exclude prior errored or empty messages from API history so retries succeed cleanly
    const cleanHistory = chatMessages
      .filter((m) => !m.error && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const historyForApi = [...cleanHistory, { role: userMsg.role, content: userMsg.content }];

    setChatMessages((prev) => [...prev, userMsg, placeholderMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAssistantChat({
        messages: historyForApi,
        profile,
        airQuality: effectiveSnapshot,
        activeScale,
        language,
        signal: controller.signal,
        onChunk: (chunk) => {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof Error ? err.message : 'Unable to reach HAWA JANO Assistant.';
        setError(msg);
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  error: true,
                  content: m.content || msg,
                }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleRetryMessage = (errorMsgIndex: number) => {
    if (streaming) return;
    // Find nearest preceding user message
    let promptText = '';
    for (let i = errorMsgIndex - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'user') {
        promptText = chatMessages[i].content;
        break;
      }
    }
    if (!promptText) return;
    // Remove the failed assistant bubble (and duplicate user bubble since sendMessage appends it)
    setChatMessages((prev) => prev.filter((_, idx) => idx !== errorMsgIndex && idx !== errorMsgIndex - 1));
    void sendMessage(promptText);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const weather = effectiveSnapshot?.weather;

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[560px] border border-[#080808] dark:border-[#222B3A] border-t-2 border-t-purple-600 dark:border-t-purple-400 bg-white dark:bg-[#0E131B]">
      {/* Assistant Header & Active Weather + AQI Context Strip */}
      <div className="p-4 border-b border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0B0F17] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </span>
              <h1 className="text-base font-bold">{t('assistant.title')}</h1>
            </div>
            <div className="text-[11px] font-mono text-neutral-500 dark:text-slate-400 mt-1.5">
              {t('assistant.languagesNote')}
            </div>
          </div>

          <button
            type="button"
            onClick={clearChat}
            disabled={streaming}
            className="px-3 py-1.5 border border-[#DADADA] dark:border-[#222B3A] dark:bg-[#151C28] hover:border-[#080808] dark:hover:border-red-400 text-xs font-medium flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
            {t('assistant.clearChat')}
          </button>
        </div>

        {/* Live Telemetry & Weather Context Chips */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#DADADA] dark:border-[#222B3A] bg-[#FAFAFA] dark:bg-[#151C28]">
            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{profile.location ? profile.location.name : t('assistant.noLocation')}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#DADADA] dark:border-[#222B3A] bg-[#FAFAFA] dark:bg-[#151C28]">
            <span
              className="w-2 h-2 shrink-0"
              style={{ backgroundColor: activeCategory.hex }}
            />
            <span>
              {activeAqiValue !== null
                ? `${activeAqiValue} ${t(`scale.${activeScale}_SHORT`)} (${t(
                    activeCategory.shortLabelKey
                  )})`
                : t('assistant.aqiUnavailable')}
            </span>
          </div>

          {weather && (
            <>
              {weather.temperature !== null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#DADADA] dark:border-[#222B3A] bg-[#FAFAFA] dark:bg-[#151C28]">
                  <Thermometer className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                  <span>
                    {Math.round(weather.temperature)}°C · {weather.weatherLabel}
                  </span>
                </div>
              )}
              {weather.humidity !== null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#DADADA] dark:border-[#222B3A] bg-[#FAFAFA] dark:bg-[#151C28]">
                  <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{Math.round(weather.humidity)}%</span>
                </div>
              )}
              {weather.windSpeed !== null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#DADADA] dark:border-[#222B3A] bg-[#FAFAFA] dark:bg-[#151C28]">
                  <Wind className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{weather.windSpeed.toFixed(0)} km/h</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Messages Viewport */}
      <div
        role="log"
        tabIndex={0}
        aria-live="polite"
        aria-label={t('assistant.title')}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FAFAFA] dark:bg-[#070A0F] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-600 dark:focus-visible:ring-purple-400"
      >
        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-2xl p-4 border ${
                  isUser
                    ? 'bg-[#080808] text-white dark:bg-[#1B2538] dark:text-white border-[#080808] dark:border-blue-500/40'
                    : msg.error
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-600 dark:border-red-500/60 text-red-800 dark:text-red-200'
                      : 'bg-white dark:bg-[#0E131B] border-[#DADADA] dark:border-[#222B3A] text-[#080808] dark:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 ${
                      isUser
                        ? 'text-blue-300'
                        : msg.error
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-purple-600 dark:text-purple-400'
                    }`}
                  >
                    {!isUser && <Sparkles className="w-3 h-3" />}
                    {isUser ? t('assistant.you') : t('assistant.aiName')}
                  </span>
                </div>

                {msg.content ? (
                  isUser ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <FormattedAssistantMessage content={msg.content} />
                  )
                ) : streaming && !isUser ? (
                  <div className="text-sm font-mono text-purple-600 dark:text-cyan-400">
                    {t('assistant.thinking')}
                  </div>
                ) : null}

                {msg.error && !streaming && (
                  <button
                    type="button"
                    onClick={() => handleRetryMessage(idx)}
                    className="mt-3 px-3 py-1.5 border border-red-600 dark:border-red-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('assistant.retry')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Vibrant Suggested Prompts Bar */}
      <div className="px-4 py-2.5 border-t border-[#DADADA] dark:border-[#222B3A] bg-[#F3F3F3] dark:bg-[#0B0F17] flex gap-2 overflow-x-auto">
        {Array.isArray(suggestedPrompts) &&
          suggestedPrompts.map((prompt, idx) => {
            const { Icon, color } = PROMPT_ICONS[idx % PROMPT_ICONS.length];
            return (
              <button
                key={prompt}
                type="button"
                disabled={streaming}
                onClick={() => void sendMessage(prompt)}
                className="px-3 py-1.5 border border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#151C28] hover:border-[#080808] dark:hover:border-cyan-400 text-xs whitespace-nowrap shrink-0 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${color}`} />
                <span>{prompt}</span>
              </button>
            );
          })}
      </div>

      {error && (
        <div
          role="alert"
          className="px-4 py-2 bg-red-50 dark:bg-red-950/40 border-t border-red-600 text-xs text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Input Form & Medical Safety Footer */}
      <div className="p-4 border-t border-[#DADADA] dark:border-[#222B3A] bg-white dark:bg-[#0E131B] space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="flex gap-2"
        >
          <label htmlFor="assistant-chat-input" className="sr-only">
            {t('assistant.placeholder')}
          </label>
          <input
            id="assistant-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('assistant.placeholder')}
            className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-[#070A0F] border border-[#DADADA] dark:border-[#222B3A] focus:outline-none focus:border-purple-600 dark:focus:border-purple-400"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-4 py-2.5 border border-red-600 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Square className="w-3.5 h-3.5" />
              {t('assistant.stop')}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {t('assistant.send')}
            </button>
          )}
        </form>

        <div className="flex items-start gap-2 text-[11px] text-neutral-500 dark:text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
          <span>{t('assistant.safetyFooter')}</span>
        </div>
      </div>
    </div>
  );
};
