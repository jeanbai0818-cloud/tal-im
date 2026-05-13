import path from 'node:path';
import fs from 'node:fs/promises';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';
import type { YachIdentity } from '../shared/types.js';

// ~/.openclaw/identity/session/current.json
const YACH_SESSION_PATH = path.join(STATE_DIR, 'identity', 'session', 'current.json');

type RawYachSession = {
  token: string;
  cloudtoken: string;
  gtoken: string;
  workcode: string;
  deptid: string;
  user: { id: string; name: string };
  updatedAt?: number;
};

function validateRaw(v: unknown): v is RawYachSession {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const user = o.user as Record<string, unknown> | undefined;
  return (
    typeof o.token === 'string' && o.token.length > 0 &&
    typeof o.cloudtoken === 'string' &&
    typeof o.gtoken === 'string' &&
    typeof o.workcode === 'string' && o.workcode.length > 0 &&
    typeof o.deptid === 'string' &&
    !!user && typeof user.id === 'string' && user.id.length > 0 &&
    typeof user.name === 'string'
  );
}

function toIdentity(raw: RawYachSession): YachIdentity {
  return {
    userId: raw.user.id,
    workcode: raw.workcode,
    name: raw.user.name,
    token: raw.token,
    cloudtoken: raw.cloudtoken,
    gtoken: raw.gtoken,
    deptid: raw.deptid,
    createdAt: raw.updatedAt ?? Date.now(),
  };
}

/** Load the personal identity from ~/.openclaw/yach-aio/session/current.json. Returns null if absent or invalid. */
export async function loadIdentity(): Promise<YachIdentity | null> {
  try {
    const raw = await fs.readFile(YACH_SESSION_PATH, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return validateRaw(parsed) ? toIdentity(parsed) : null;
  } catch {
    return null;
  }
}

/** Persist the personal identity to the session file. */
export async function saveIdentity(identity: YachIdentity): Promise<void> {
  await fs.writeFile(YACH_SESSION_PATH, JSON.stringify(identity, null, 2), 'utf8');
}

/** Delete the stored identity (logout). */
export async function clearIdentity(): Promise<void> {
  try {
    await fs.unlink(YACH_SESSION_PATH);
  } catch {
    // Already absent — fine
  }
}
