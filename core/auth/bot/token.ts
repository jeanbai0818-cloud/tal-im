import { OAPI_BASE, BOT_TOKEN_REFRESH_EARLY_MS } from '../../shared/constants.js';

type CachedEntry = { value: string; expiresAt: number };

// In-memory cache keyed by "baseUrl:appKey"
const cache = new Map<string, CachedEntry>();

/**
 * Single-flight map: when the cache is stale and multiple concurrent callers
 * arrive simultaneously, only one fetch is issued. The rest wait on the same
 * promise, eliminating thundering-herd on the token endpoint.
 */
const inflight = new Map<string, Promise<string>>();

async function fetchBotToken(
  appKey: string,
  appSecret: string,
  baseUrl: string,
): Promise<string> {
  const key = `${baseUrl}:${appKey}`;
  const url = `${baseUrl}/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`[yach] gettoken HTTP ${res.status}`);

  const data = await res.json() as {
    code?: number;
    msg?: string;
    obj?: { access_token?: string; expired_time?: number };
  };

  if (data.code !== 200 || !data.obj?.access_token) {
    throw new Error(`[yach] 机器人令牌获取失败: ${data.msg ?? JSON.stringify(data)}`);
  }

  cache.set(key, {
    value: data.obj.access_token,
    // expired_time is a Unix second timestamp; subtract early-refresh buffer
    expiresAt: (data.obj.expired_time ?? 0) * 1_000 - BOT_TOKEN_REFRESH_EARLY_MS,
  });

  return data.obj.access_token;
}

/**
 * Get a bot access token for the given credentials.
 *
 * Cache hit:   returns immediately (O(1) map lookup).
 * Cache miss:  at most ONE fetch is in-flight per (baseUrl, appKey) pair.
 *              Concurrent callers reuse the same promise instead of flooding
 *              the token endpoint.
 */
export async function getBotToken(
  appKey: string,
  appSecret: string,
  baseUrl = OAPI_BASE,
): Promise<string> {
  const key = `${baseUrl}:${appKey}`;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetchBotToken(appKey, appSecret, baseUrl).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/** Force eviction — next call triggers a fresh fetch. */
export function evictBotToken(appKey: string, baseUrl = OAPI_BASE): void {
  const key = `${baseUrl}:${appKey}`;
  cache.delete(key);
  // Don't cancel inflight — let it complete; the cached value will just be
  // overwritten on the next getBotToken call after eviction.
}
