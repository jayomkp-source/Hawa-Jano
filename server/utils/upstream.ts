export type UpstreamErrorCategory =
  | 'NETWORK'
  | 'HTTP_ERROR'
  | 'UPSTREAM_HTML'
  | 'INVALID_JSON';

export class UpstreamServiceError extends Error {
  readonly category: UpstreamErrorCategory;
  readonly statusCode?: number;

  constructor(category: UpstreamErrorCategory, message: string, statusCode?: number) {
    super(message);
    this.name = 'UpstreamServiceError';
    this.category = category;
    this.statusCode = statusCode;
  }
}

export class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export function sanitizePromptText(value: unknown, maxLen = 100): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t\x00-\x1f\x7f]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function looksLikeHtmlOrNonJson(rawText: string, contentType: string): boolean {
  const lowerCt = contentType.toLowerCase();
  if (lowerCt.includes('text/html') || lowerCt.includes('application/xhtml')) {
    return true;
  }
  const trimmed = rawText.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('<') || /^<!doctype/i.test(trimmed) || /^the page /i.test(trimmed)) {
    return true;
  }
  return !trimmed.startsWith('{') && !trimmed.startsWith('[');
}

export function parseUpstreamJsonText(rawText: string, contentType = ''): unknown {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new UpstreamServiceError('INVALID_JSON', 'Upstream returned an empty response');
  }
  if (looksLikeHtmlOrNonJson(trimmed, contentType)) {
    throw new UpstreamServiceError('UPSTREAM_HTML', 'Upstream returned HTML or non-JSON content');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new UpstreamServiceError('INVALID_JSON', 'Upstream returned malformed JSON');
  }
}

export function stripMarkdownJsonFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
  return trimmed;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new RequestTimeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export type JsonFetcher = (url: string, timeoutMs?: number) => Promise<unknown>;

export function createJsonFetcher(fetchImpl: typeof fetch): JsonFetcher {
  return async (url: string, timeoutMs = 10000): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: globalThis.Response;
      try {
        res = await fetchImpl(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'HAWA-JANO/1.0',
            Accept: 'application/json',
          },
        });
      } catch (err) {
        const reason =
          err instanceof Error && err.name === 'AbortError'
            ? 'Upstream request timed out'
            : 'Network error reaching upstream service';
        throw new UpstreamServiceError('NETWORK', reason);
      }

      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();

      if (!res.ok) {
        if (looksLikeHtmlOrNonJson(rawText, contentType)) {
          throw new UpstreamServiceError(
            'UPSTREAM_HTML',
            `Upstream returned HTTP ${res.status} HTML error page`,
            res.status
          );
        }
        throw new UpstreamServiceError('HTTP_ERROR', `Upstream HTTP ${res.status}`, res.status);
      }

      return parseUpstreamJsonText(rawText, contentType);
    } finally {
      clearTimeout(timer);
    }
  };
}
