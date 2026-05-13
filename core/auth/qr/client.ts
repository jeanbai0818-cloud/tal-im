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
    path: `/usergroup/qrcode/user/get?randstr=${encodeURIComponent(sessionId)}`,
  }) as Record<string, unknown>;

  // Server-side expiry codes
  const serverCode = Number(raw.serverCode ?? 0);
  const serverMsg = String(raw.serverMessage ?? '');
  if (serverCode === 10035 || serverMsg.includes('过期') || serverMsg.includes('expire')) {
    return { status: 'expired', code: serverCode, message: serverMsg };
  }

  const status = Number(raw.status ?? 0);

  if (status === 2) {
    const identity = extractIdentity(raw);
    if (identity) return { status: 'confirmed', identity };
    // Confirmed but identity not yet in payload — caller gives grace period
    return { status: 'scanned' };
  }

  if (status === 1) return { status: 'scanned' };
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
