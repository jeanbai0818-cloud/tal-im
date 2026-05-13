import { createHash, createCipheriv } from 'node:crypto';
import { hostname, release } from 'node:os';
import { SIGN_KEY, PLATFORM_CONFIG_KEY, PLUGIN_VERSION } from './constants.js';

// ── MD5 request signing ───────────────────────────────────────────────────────

function flatten(val: unknown, out: Record<string, string>, prefix: string): void {
  if (val == null || typeof val === 'function') return;
  if (typeof val !== 'object') { out[prefix] = String(val); return; }
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    flatten(v, out, prefix ? `${prefix}.${k}` : k);
  }
}

function toRecord(val: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  flatten(val, out, '');
  return out;
}

/**
 * Build an MD5 request signature.
 * All request fields are sorted alphabetically, concatenated as key=value pairs,
 * and the shared SIGN_KEY is appended before hashing.
 */
export function buildSign(
  payload: unknown,
  timeDiffMs = 0,
): { sign: string; timestamp: number } {
  const timestamp = Math.floor((Date.now() + timeDiffMs) / 1000);
  const record: Record<string, string> = { ...toRecord(payload), timestamp: String(timestamp) };
  const src = [
    ...Object.keys(record).sort().map((k) => `${k}=${record[k] ?? ''}`),
    `key=${SIGN_KEY}`,
  ].join('&');
  return { sign: createHash('md5').update(src).digest('hex'), timestamp };
}

// ── Gateway token (AES-128-ECB) ───────────────────────────────────────────────

/**
 * Compute the gateway token by AES-128-ECB encrypting "workcode_token".
 * Returns an empty string if the key is misconfigured.
 */
export function computeGtoken(workcode: string, token: string): string {
  const key = Buffer.from(PLATFORM_CONFIG_KEY, 'utf8');
  if (key.byteLength !== 16) return '';
  const cipher = createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([
    cipher.update(`${workcode}_${token}`, 'utf8'),
    cipher.final(),
  ]).toString('base64');
}

// ── Device fingerprint & trace IDs ───────────────────────────────────────────

let _deviceId: string | undefined;

/** Stable per-installation device ID: SHA-256 of platform fingerprint, 32 hex chars. */
export function deviceId(): string {
  if (!_deviceId) {
    const seed = `yach-aio|${process.platform}|${hostname()}`;
    _deviceId = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  }
  return _deviceId;
}

/** Per-request trace ID: 12-char device prefix + SHA-1 of (timestamp|random|url). */
export function traceId(url: string): string {
  const seed = `${Date.now()}|${Math.random()}|${url}`;
  const suffix = createHash('sha1').update(seed).digest('hex').slice(0, 12);
  return `${deviceId().slice(0, 12)}-${suffix}-${url}`;
}

// ── Common request headers ────────────────────────────────────────────────────

export type IdentityHeaders = {
  token?: string;
  gtoken?: string;
  workcode?: string;
  deptid?: string;
} | null;

/** Build the standard header set for a signed CAPI request. */
export function buildHeaders(params: {
  sign: string;
  timestamp: number;
  url: string;
  identity?: IdentityHeaders;
}): Record<string, string> {
  const { sign, timestamp, url, identity } = params;
  return {
    ...(identity?.token    ? { Authorization: identity.token }    : {}),
    ...(identity?.gtoken   ? { gtoken: identity.gtoken }          : {}),
    ...(identity?.workcode ? { workcode: identity.workcode }       : {}),
    ...(identity?.deptid   ? { deptid: identity.deptid }          : {}),
    HTTP_CONTENT_LANGUAGE: 'zh-CN',
    sign,
    timestamp: String(timestamp),
    os: process.platform,
    'device-id': deviceId(),
    'device-name': hostname(),
    'system-ver': `${process.platform} ${release()}`,
    'client-ver': PLUGIN_VERSION,
    traceid: traceId(url),
  };
}
