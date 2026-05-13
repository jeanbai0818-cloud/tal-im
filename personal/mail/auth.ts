/**
 * Mail session auth.
 *
 * Flow: POST /94capi/txmail/login (signed) → get login_url
 *       GET login_url with redirect-following + cookie jar → extract sid
 *       Cache session at ~/.openclaw/identity/mail/session.json
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';
import { loadIdentity } from '../../core/session/identity.js';
import { buildSign, buildHeaders } from '../../core/shared/crypto.js';
import { CAPI_BASE, PLUGIN_VERSION } from '../../core/shared/constants.js';
import { followRedirects, type SimpleCookie } from '../../core/shared/http-cookie.js';
import type { YachIdentity } from '../../core/shared/types.js';

const SESSION_PATH = path.join(STATE_DIR, 'identity', 'mail', 'session.json');
const TXMAIL_LOGIN_PATH = '/94capi/txmail/login';
/** Treat session as stale after 8 hours */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type MailSession = {
  email: string;
  baseUrl: string;   // e.g. https://mail.qiye.163.com/js6
  sid: string;
  cookies: SimpleCookie[];
  updatedAt: number;
};

// ── Mail login ────────────────────────────────────────────────────────────────

function getPlatform(): string {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'pc';
  return '';
}

function extractSid(finalUrl: string, html: string): string {
  const urlMatch = finalUrl.match(/[?&]sid=([^&]+)/i);
  if (urlMatch?.[1]) return decodeURIComponent(urlMatch[1]);
  const htmlMatch = html.match(/sid:'([^']+)'/i) ?? html.match(/\bsid\s*[=:]\s*['"]([\w.]+)['"]/i);
  if (htmlMatch?.[1]) return htmlMatch[1];
  throw new Error('Mail auth: could not extract sid from final page');
}

function extractMailBaseUrl(finalUrl: string): string {
  try {
    const u = new URL(finalUrl);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return `${u.origin}/${seg ?? 'js6'}`;
  } catch {
    return finalUrl;
  }
}

async function bootstrapMailSession(identity: YachIdentity): Promise<MailSession> {
  // Step 1: signed POST to txmail/login
  const body = { from: 'email', plat: getPlatform() };
  const { sign, timestamp } = buildSign(body);
  const url = `${CAPI_BASE}${TXMAIL_LOGIN_PATH}`;
  const headers = buildHeaders({ sign, timestamp, url, identity });

  const loginRes = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'client-ver': PLUGIN_VERSION,
    },
    body: new URLSearchParams(body as Record<string, string>).toString(),
  });

  if (!loginRes.ok) throw new Error(`Mail auth: txmail/login HTTP ${loginRes.status}`);

  const loginJson = await loginRes.json() as { code?: number; obj?: { email?: string; login_url?: string } };
  const code = Number(loginJson.code ?? -1);
  if (code !== 200 && code !== 0) throw new Error(`Mail auth: txmail/login failed (code ${code})`);
  const email = loginJson.obj?.email ?? '';
  const loginUrl = loginJson.obj?.login_url;
  if (!loginUrl) throw new Error('Mail auth: no login_url in txmail/login response');

  // Step 2: follow SSO redirect chain
  const { finalUrl, cookies, body: html } = await followRedirects(loginUrl);
  const sid = extractSid(finalUrl, html);
  const baseUrl = extractMailBaseUrl(finalUrl);

  const session: MailSession = { email, baseUrl, sid, cookies, updatedAt: Date.now() };
  await fs.mkdir(path.dirname(SESSION_PATH), { recursive: true });
  await fs.writeFile(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8');
  return session;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getMailSession(): Promise<MailSession> {
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf8');
    const cached = JSON.parse(raw) as MailSession;
    if (cached.sid && Date.now() - cached.updatedAt < SESSION_TTL_MS) {
      return cached;
    }
  } catch {
    // cache miss
  }

  const identity = await loadIdentity();
  if (!identity) throw new Error('未找到知音楼登录凭证，请先完成扫码登录（openclaw yach-aio login）');
  return bootstrapMailSession(identity);
}
