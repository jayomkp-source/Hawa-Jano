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
}): Promise<DailyRoutinePlan> {
  const res = await fetch('/api/gemini/routine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate personalized daily routine.');
  }

  return data as DailyRoutinePlan;
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
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: params.messages,
      profile: params.profile,
      airQuality: params.airQuality,
      activeScale: params.activeScale,
      language: params.language,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    let errorMsg = 'Unable to reach HAWA JANO Assistant.';
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // keep default
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

  while (true) {
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

  if (!receivedAnyText) {
    throw new Error('HAWA JANO did not return a response. Please try again.');
  }
}
