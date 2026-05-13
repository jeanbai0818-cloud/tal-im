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
  body?: unknown;
  identity?: Pick<YachIdentity, 'token' | 'gtoken' | 'workcode' | 'deptid'> | null;
  baseUrl?: string;
};

/**
 * Signed CAPI request with automatic time-drift compensation.
 * Returns the parsed JSON response body.
 * Throws on non-2xx HTTP status.
 */
export async function yfetch(opts: FetchOpts): Promise<unknown> {
  const base = opts.baseUrl ?? CAPI_BASE;
  const url = `${base}${opts.path}`;
  const payload = opts.body ?? {};
  const { sign, timestamp } = buildSign(payload, timeDiffMs);

  const res = await fetch(url, {
    method: opts.method ?? 'POST',
    headers: {
      ...buildHeaders({ sign, timestamp, url, identity: opts.identity ?? null }),
      'Content-Type': 'application/json',
    },
    body: opts.method === 'GET' ? undefined : JSON.stringify(payload),
  });

  syncTime(res);
  if (!res.ok) throw new Error(`[yach] ${opts.method ?? 'POST'} ${opts.path} failed: HTTP ${res.status}`);
  return res.json();
}
