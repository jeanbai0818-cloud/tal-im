import { CAPI_BASE } from './constants.js';
import { buildSign, buildHeaders } from './crypto.js';
import type { YachIdentity } from './types.js';

// Tracked server-local clock drift; updated on every response
let timeDiffMs = 0;

function syncTime(res: Response): void {
  const raw = res.headers.get('x-timestamp');
  if (!raw) return;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) timeDiffMs = parsed - Date.now();
}

export type FetchOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  /** GET query params — included in signature and appended to URL */
  params?: Record<string, string | number | boolean>;
  body?: unknown;
  identity?: Pick<YachIdentity, 'token' | 'gtoken' | 'workcode' | 'deptid'> | null;
  baseUrl?: string;
};

/**
 * Signed CAPI request with automatic time-drift compensation.
 * Returns the parsed JSON response body.
 * Throws on non-2xx HTTP status.
 * For GET: pass query params via `params` so they are included in the signature.
 */
export async function yfetch(opts: FetchOpts): Promise<unknown> {
  const base = opts.baseUrl ?? CAPI_BASE;

  // For GET, sign `params`; for POST/PUT, sign `body`
  const isGet = (opts.method ?? 'POST') === 'GET';
  const signPayload = isGet ? (opts.params ?? {}) : (opts.body ?? {});
  const { sign, timestamp } = buildSign(signPayload, timeDiffMs);

  // Build URL: append signed params as query string for GET requests
  let urlStr = `${base}${opts.path}`;
  if (isGet && opts.params && Object.keys(opts.params).length > 0) {
    const qs = new URLSearchParams(
      Object.entries(opts.params).map(([k, v]) => [k, String(v)]),
    ).toString();
    urlStr = urlStr.includes('?') ? `${urlStr}&${qs}` : `${urlStr}?${qs}`;
  }

  const res = await fetch(urlStr, {
    method: opts.method ?? 'POST',
    headers: {
      ...buildHeaders({ sign, timestamp, url: opts.path, identity: opts.identity ?? null }),
      'Content-Type': 'application/json',
    },
    body: isGet ? undefined : JSON.stringify(opts.body ?? {}),
  });

  syncTime(res);
  if (!res.ok) throw new Error(`[yach] ${opts.method ?? 'POST'} ${opts.path} failed: HTTP ${res.status}`);
  return res.json();
}
