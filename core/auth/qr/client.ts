import { QR_URL_PREFIX, QR_EXPIRE_MS } from '../../shared/constants.js';
import { computeGtoken } from '../../shared/crypto.js';
import { yfetch } from '../../shared/http.js';
import type { YachIdentity, YachQrCode, YachQrPollState } from '../../shared/types.js';

// ── QR code fetch ─────────────────────────────────────────────────────────────

/** Request a new QR login code from the server. */
export async function getQrCode(): Promise<YachQrCode> {
  const res = await yfetch({ path: '/94capi/ucenter/qrcode/randstr/save', body: {} }) as {
    code?: number;
    msg?: string;
    obj?: { randstr?: string };
  };

  if (res.code !== 200 || !res.obj?.randstr) {
    throw new Error(res.msg ?? '二维码生成失败，请重试');
  }

  return {
    sessionId: res.obj.randstr,
    url: `${QR_URL_PREFIX}${res.obj.randstr}`,
    expiresAt: Date.now() + QR_EXPIRE_MS,
  };
}

// ── QR status poll ────────────────────────────────────────────────────────────

/** Poll the server for the current QR scan state. */
export async function pollQrCode(sessionId: string): Promise<YachQrPollState> {
  const raw = await yfetch({
    method: 'GET',
    path: '/usergroup/qrcode/user/get',
    params: { randstr: sessionId },
  }) as Record<string, unknown>;

  const serverCode = Number(raw.code ?? raw.serverCode ?? 0);
  const serverMsg = String(raw.msg ?? raw.message ?? raw.serverMessage ?? '').trim();

  // Expiry: server code 10035 or message contains expiry keywords
  if (serverCode === 10035 || /二维码已过期|登录二维码已过期|已过期/.test(serverMsg)) {
    return { status: 'expired', code: serverCode, message: serverMsg };
  }

  // Confirmed: code=200, or message signals success, or session payload present
  const confirmedByMsg = /(授权成功|登录成功|确认成功|扫码登录成功|登录完成|已确认|已登录)/.test(serverMsg);
  const identity = extractIdentity(raw);
  if (serverCode === 200 || confirmedByMsg || identity) {
    if (identity) return { status: 'confirmed', identity };
    // Server says confirmed but session payload not yet in this response — grace period
    return { status: 'scanned' };
  }

  // Scanned but not yet confirmed
  const scannedByMsg = /(已扫码|已扫描|待确认|确认登录|请确认|待授权|扫码成功)/.test(serverMsg);
  if (scannedByMsg) return { status: 'scanned' };

  return { status: 'pending' };
}

// ── Identity extraction ───────────────────────────────────────────────────────

/** Collect all plain-object values from a nested structure (max depth 5). */
function collectSources(val: unknown, depth = 0): Record<string, unknown>[] {
  if (!val || typeof val !== 'object' || depth > 5) return [];
  if (Array.isArray(val)) return val.flatMap((v) => collectSources(v, depth));
  const rec = val as Record<string, unknown>;
  return [rec, ...Object.values(rec).flatMap((v) => collectSources(v, depth + 1))];
}

function pickString(sources: Record<string, unknown>[], keys: string[]): string {
  for (const key of keys) {
    for (const src of sources) {
      const v = src[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return '';
}

/** Decode URL-encoded or \uXXXX-encoded display names. */
function decodeName(raw: string): string {
  const unicodeDecoded = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  try { return decodeURIComponent(unicodeDecoded); } catch { return unicodeDecoded; }
}

function extractIdentity(raw: unknown): YachIdentity | null {
  const sources = collectSources(raw);

  const token = pickString(sources, [
    'r_o_token', 'ro_token', 'roToken',
    'token', 'access_token', 'jwttoken', 'jwt_token',
  ]);
  const workcode = pickString(sources, ['work_code', 'workcode', 'workCode']);
  const deptid = pickString(sources, ['dept_id', 'deptid', 'deptId']);
  const cloudtoken = pickString(sources, ['cloudtoken', 'cloudToken', 'cloud_token']);
  const userId = pickString(sources, ['id', 'userId', 'user_id', 'uid']);
  const rawName = pickString(sources, ['name', 'displayName', 'display_name', 'nickName']);

  if (!token || !workcode) return null;

  return {
    userId,
    workcode,
    name: decodeName(rawName),
    token,
    cloudtoken,
    gtoken: computeGtoken(workcode, token),
    deptid,
    createdAt: Date.now(),
  };
}
