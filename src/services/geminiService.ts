import { parseApiJson } from './airQualityService';
import type {
  AirQualitySnapshot,
  AqiScale,
  ChatMessage,
  DailyRoutinePlan,
  SupportedLanguage,
  UserProfile,
} from '../types';

export async function generateDailyRoutine(params: {
  profile: UserProfile;
  airQuality: AirQualitySnapshot | null;
  activeScale: AqiScale;
  language: SupportedLanguage;
  signal?: AbortSignal;
}): Promise<DailyRoutinePlan> {
  const { signal, ...payload } = params;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30000);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch('/api/gemini/routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) {
        throw new Error('AI request timed out. Please try again.');
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      throw new Error('AI connection unavailable. Please check your API configuration or try again.');
    }

    const plan = await parseApiJson<DailyRoutinePlan>(
      res,
      'Failed to generate personalized daily routine.'
    );
    if (!plan || !Array.isArray(plan.recommendations) || typeof plan.aqiSummary !== 'string') {
      throw new Error('Failed to generate personalized daily routine.');
    }
    return plan;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function streamAssistantChat(params: {
  messages: Array<Pick<ChatMessage, 'role' | 'content'>>;
  profile: UserProfile;
  airQuality: AirQualitySnapshot | null;
  activeScale: AqiScale;
  language: SupportedLanguage;
  onChunk: (chunkText: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const resetInactivityTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
  };

  const onExternalAbort = () => controller.abort();
  if (params.signal?.aborted) {
    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';
    throw abortErr;
  }
  params.signal?.addEventListener('abort', onExternalAbort, { once: true });
  resetInactivityTimer();

  try {
    let res: Response;
    try {
      res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: params.messages,
          profile: params.profile,
          airQuality: params.airQuality,
          activeScale: params.activeScale,
          language: params.language,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) {
        throw new Error('AI request timed out. Please try again.');
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      throw new Error('AI connection unavailable. Please check your API configuration or try again.');
    }

    if (!res.ok) {
      let errorMsg = 'AI connection unavailable. Please check your API configuration or try again.';
      try {
        await parseApiJson<unknown>(res, errorMsg);
      } catch (err) {
        if (err instanceof Error && err.message) {
          errorMsg = err.message;
        }
      }
      throw new Error(errorMsg);
    }

    if (!res.body) {
      throw new Error('Streaming response not supported by the browser.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedAnyText = false;

    const processEventBlock = (block: string) => {
      const trimmed = block.trim();
      if (!trimmed) return;
      for (const rawLine of trimmed.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let parsed: { text?: string; done?: boolean; error?: string };
        try {
          parsed = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };
        } catch {
          continue;
        }

        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (parsed.text) {
          receivedAnyText = true;
          params.onChunk(parsed.text);
        }
      }
    };

    try {
      while (true) {
        resetInactivityTimer();
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) {
            processEventBlock(buffer);
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          processEventBlock(block);
        }
      }
    } catch (err) {
      if (timedOut) {
        throw new Error('AI request timed out. Please try again.');
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      throw err;
    }

    if (!receivedAnyText) {
      throw new Error('HAWA JANO did not return a response. Please try again.');
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    params.signal?.removeEventListener('abort', onExternalAbort);
  }
}
