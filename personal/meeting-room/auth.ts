/**
 * Meeting-room session auth.
 *
 * Flow: POST /94capi/ucenter/auth/code (signed) → authCode
 *       GET CONTROLLER_APP_LOGIN_URL (redirect:manual) → Location + cookies
 *       Append _authCode to Location → follow redirect chain
 *       followRedirects(PORTAL_LOGIN_URL) → stop at huiyi.tal.com/auth-meeting-login
 *       Extract token/corpid/agentid params → GET MEETING_AUTH_LOGIN_URL
 *       Extract sessionid cookie + userId → cache session
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';
import { loadIdentity } from '../../core/session/identity.js';
import { buildSign, buildHeaders } from '../../core/shared/crypto.js';
import { CAPI_BASE, PLUGIN_VERSION } from '../../core/shared/constants.js';
import { followRedirects, parseCookies, mergeCookies, buildCookieHeader, type SimpleCookie } from '../../core/shared/http-cookie.js';

const SESSION_PATH = path.join(STATE_DIR, 'identity', 'meeting-room', 'session.json');
/** Treat session as stale after 12 hours */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const AUTH_CODE_PATH = '/94capi/ucenter/auth/code';
const CONTROLLER_APP_LOGIN_URL = 'https://controller.100tal.com:8443/idp/app/login?app_id=app_ipg9oj6pxbvgkzglmuez-l7pop&ins_id=spa_d0e97e32-909d-4162-a68f-58609950a74d&access_type=app&redirect_url=https%3A%2F%2Fhuiyi.tal.com%2Fbooking%2Fbooking%3Fto%3Dbooking%252Fbooking';
const MEETING_PORTAL_LOGIN_URL = 'https://sso.100tal.com/portal/login/978353613';
const MEETING_AUTH_LOGIN_URL = 'https://huiyi.tal.com/prod-api/mobile/auth_login';
const MEETING_BOOKING_URL = 'https://huiyi.tal.com/booking/booking?to=booking%2Fbooking';

export type MeetingRoomSession = {
  sessionId: string;
  userId: string;
  userName: string;
  workcode: string;
  cookies: SimpleCookie[];
  updatedAt: number;
};

async function requestAuthCode(): Promise<string> {
  const identity = await loadIdentity();
  if (!identity) throw new Error('未找到知音楼登录凭证，请先完成扫码登录');

  const body = {};
  const { sign, timestamp } = buildSign(body);
  const url = `${CAPI_BASE}${AUTH_CODE_PATH}`;
  const headers = buildHeaders({ sign, timestamp, url, identity });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'client-ver': PLUGIN_VERSION,
    },
    body: new URLSearchParams({}).toString(),
  });
  if (!res.ok) throw new Error(`会议室鉴权: auth/code HTTP ${res.status}`);

  const json = await res.json() as { code?: number; obj?: { code?: string } };
  if (Number(json.code ?? -1) !== 200) {
    throw new Error(`会议室鉴权: auth/code 失败 (code ${json.code ?? 'unknown'})`);
  }
  const authCode = json.obj?.code ?? '';
  if (!authCode) throw new Error('会议室鉴权: auth/code 未返回 authCode');
  return authCode;
}

async function bootstrapSession(): Promise<MeetingRoomSession> {
  const identity = await loadIdentity();
  if (!identity) throw new Error('未找到知音楼登录凭证，请先完成扫码登录');

  const authCode = await requestAuthCode();

  // Step 1: GET CONTROLLER URL → get Location redirect
  const controllerUrl = new URL(CONTROLLER_APP_LOGIN_URL);
  const initRes = await fetch(CONTROLLER_APP_LOGIN_URL, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 Yach-TAL-IM/1.0',
    },
  });
  let cookies: SimpleCookie[] = parseCookies(initRes.headers, controllerUrl.hostname);
  const initLocation = initRes.headers.get('location');
  if (!(initRes.status >= 300 && initRes.status < 400) || !initLocation) {
    throw new Error('会议室 SSO: CONTROLLER_APP_LOGIN 未返回重定向');
  }

  // Append authCode to redirect location
  const authEntryUrl = new URL(initLocation.startsWith('http') ? initLocation : new URL(initLocation, CONTROLLER_APP_LOGIN_URL).href);
  authEntryUrl.searchParams.set('_authCode', authCode);

  // Step 2: follow redirect chain from authEntryUrl
  const sso = await followRedirects(authEntryUrl.toString(), cookies);
  cookies = sso.cookies;

  // Step 3: follow portal login → stop at huiyi.tal.com/auth-meeting-login
  const portal = await followRedirects(MEETING_PORTAL_LOGIN_URL, cookies, {
    stopOn: (url) => url.hostname === 'huiyi.tal.com' && url.pathname === '/auth-meeting-login',
  });
  cookies = portal.cookies;

  const authMeetingUrl = new URL(portal.finalUrl);
  const token = authMeetingUrl.searchParams.get('token') ?? '';
  const corpid = authMeetingUrl.searchParams.get('corpid') ?? '978353613';
  const agentid = authMeetingUrl.searchParams.get('agentid') ?? corpid;
  const type = authMeetingUrl.searchParams.get('type') ?? 'YachSSO';
  const company = authMeetingUrl.searchParams.get('company') ?? '1';
  if (!token) throw new Error('会议室 SSO: portal 未返回 app token');

  // Step 4: GET MEETING_AUTH_LOGIN_URL to exchange token for sessionid
  const authLoginUrl = new URL(MEETING_AUTH_LOGIN_URL);
  authLoginUrl.searchParams.set('corpid', corpid);
  authLoginUrl.searchParams.set('agentid', agentid);
  authLoginUrl.searchParams.set('type', type);
  authLoginUrl.searchParams.set('company', company);
  authLoginUrl.searchParams.set('token', token);
  authLoginUrl.searchParams.set('timeZone', 'UTC+08:00');
  authLoginUrl.searchParams.set('cropid', corpid);

  const cookieStr = buildCookieHeader(cookies, authLoginUrl.hostname);
  const authLoginRes = await fetch(authLoginUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: MEETING_BOOKING_URL,
      'User-Agent': 'Mozilla/5.0 Yach-TAL-IM/1.0',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
  });
  cookies = mergeCookies(cookies, parseCookies(authLoginRes.headers, authLoginUrl.hostname));

  const authText = await authLoginRes.text();
  let authPayload: Record<string, unknown>;
  try {
    authPayload = JSON.parse(authText) as Record<string, unknown>;
  } catch {
    throw new Error(`会议室 auth_login 返回非 JSON 响应: HTTP ${authLoginRes.status}`);
  }
  if (Number(authPayload.code ?? -1) !== 0) {
    const msg = String((authPayload as Record<string, unknown>).message ?? (authPayload as Record<string, unknown>).msg ?? '');
    throw new Error(`会议室 auth_login 失败 (code=${authPayload.code ?? 'unknown'}): ${msg}`);
  }

  const data = (authPayload.data ?? {}) as Record<string, unknown>;
  const userinfo = (data.userinfo ?? {}) as Record<string, unknown>;
  const userId = String(userinfo.user_id ?? '').trim();
  const userName = String(userinfo.name ?? identity.name ?? '').trim();
  const sessionId = cookies.find((c) => c.name === 'sessionid')?.value ?? '';

  if (!userId || !sessionId) {
    throw new Error(`会议室 SSO 完成但未能获取 sessionid 或 userId (userId=${userId || '-'})`);
  }

  const session: MeetingRoomSession = {
    sessionId,
    userId,
    userName,
    workcode: identity.workcode,
    cookies,
    updatedAt: Date.now(),
  };
  await fs.mkdir(path.dirname(SESSION_PATH), { recursive: true });
  await fs.writeFile(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8');
  return session;
}

export async function getMeetingRoomSession(): Promise<MeetingRoomSession> {
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf8');
    const cached = JSON.parse(raw) as MeetingRoomSession;
    if (cached.sessionId && Date.now() - cached.updatedAt < SESSION_TTL_MS) {
      return cached;
    }
  } catch {
    // cache miss
  }
  return bootstrapSession();
}
