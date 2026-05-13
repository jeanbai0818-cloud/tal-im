/**
 * 知音楼 OAPI 统一 fetch 封装。
 *
 * 优化点：
 * - 自动注入 yach-version-area 请求头（知音楼网关路由必需）
 * - 每次请求独立 AbortController，15 秒超时
 * - 服务端 5xx 自动重试 3 次，退避 0 → 500ms → 1500ms
 * - 4xx 和业务错误码不重试（调用方决策）
 * - body 为 string/URLSearchParams 才能安全重试；流式 body 不可重试
 */

const YACH_VERSION_AREA = 'YachAreaRed';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1_500] as const; // delays before attempt 2 and 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetriableBody(init?: RequestInit): boolean {
  if (!init?.body) return true;
  return typeof init.body === 'string' || init.body instanceof URLSearchParams;
}

async function attemptFetch(url: string, init: RequestInit | undefined): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'yach-version-area': YACH_VERSION_AREA,
        ...init?.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function oapiFetch(url: string, init?: RequestInit): Promise<Response> {
  const canRetry = isRetriableBody(init);
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    try {
      const res = await attemptFetch(url, init);

      // Retry only on 5xx server errors when body is safe to resend
      if (res.status >= 500 && canRetry && attempt < MAX_ATTEMPTS - 1) {
        lastErr = new Error(`[yach-oapi] HTTP ${res.status} on ${url}`);
        continue;
      }

      return res;
    } catch (err) {
      lastErr = err;
      if (!canRetry || attempt === MAX_ATTEMPTS - 1) throw err;
      // Network error or timeout — retry
    }
  }

  throw lastErr;
}

/**
 * 解析 OAPI JSON 响应，统一错误格式。
 * 返回 obj 字段（知音楼所有接口统一封装在 obj 里）。
 */
export async function parseOapiJson<T = unknown>(
  res: Response,
  context: string,
): Promise<T> {
  const text = await res.text();

  let parsed: { code?: unknown; msg?: string; obj?: unknown };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(`[yach-oapi] ${context}: JSON parse error (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const code = Number(parsed.code ?? 0);
  if (code !== 0 && code !== 200) {
    const { YachApiError } = await import('./errors.js');
    throw new YachApiError(`[yach-oapi] ${context} failed (code=${code}): ${parsed.msg ?? text.slice(0, 200)}`, code);
  }

  return (parsed.obj ?? parsed) as T;
}
