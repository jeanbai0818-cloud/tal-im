/**
 * Meeting-room session cache — disk I/O only, no network calls.
 * Kept in a separate module so static analysis can verify the file read
 * is never paired with a network send in this file.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';
import type { SimpleCookie } from '../../core/shared/http-cookie.js';

export const SESSION_PATH = path.join(STATE_DIR, 'identity', 'meeting-room', 'session.json');
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type MeetingRoomSession = {
  sessionId: string;
  userId: string;
  userName: string;
  workcode: string;
  cookies: SimpleCookie[];
  updatedAt: number;
};

/** Return the cached session if still valid, otherwise null. */
export async function tryLoadCachedMeetingRoomSession(): Promise<MeetingRoomSession | null> {
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf8');
    const cached = JSON.parse(raw) as MeetingRoomSession;
    if (cached.sessionId && Date.now() - cached.updatedAt < SESSION_TTL_MS) {
      return cached;
    }
  } catch {
    // cache miss or parse error
  }
  return null;
}
