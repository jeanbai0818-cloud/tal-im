import { QR_POLL_MS, QR_GRACE_MS } from '../../shared/constants.js';
import { pollQrCode } from './client.js';
import type { YachIdentity, YachQrCode } from '../../shared/types.js';

export class QrTimeoutError extends Error {
  constructor(sessionId: string) {
    super(`二维码已过期（sessionId: ${sessionId}）`);
    this.name = 'QrTimeoutError';
  }
}

export type LoginProgress =
  | { event: 'waiting' }
  | { event: 'scanned' }
  | { event: 'confirmed' };

/**
 * Poll until the user confirms the QR login or the code expires.
 *
 * - Calls `onProgress` on each state transition.
 * - Allows up to QR_GRACE_MS past expiry for in-flight confirmations.
 * - Throws `QrTimeoutError` if time runs out.
 */
export async function waitForLogin(
  qrCode: YachQrCode,
  opts: { onProgress?: (p: LoginProgress) => void; signal?: AbortSignal } = {},
): Promise<YachIdentity> {
  const { onProgress, signal } = opts;

  // Track when we saw a "scanned" but not yet "confirmed" response
  // so we can apply the grace window correctly
  let scannedAt: number | undefined;

  const deadline = (): number =>
    scannedAt !== undefined
      ? Math.max(qrCode.expiresAt, scannedAt + QR_GRACE_MS)
      : qrCode.expiresAt;

  let lastStatus = '';

  while (Date.now() <= deadline()) {
    if (signal?.aborted) throw new QrTimeoutError(qrCode.sessionId);

    const state = await pollQrCode(qrCode.sessionId);

    if (state.status === 'confirmed') {
      onProgress?.({ event: 'confirmed' });
      return state.identity;
    }

    if (state.status === 'expired') {
      throw new QrTimeoutError(qrCode.sessionId);
    }

    if (state.status === 'scanned') {
      scannedAt ??= Date.now();
      if (lastStatus !== 'scanned') {
        onProgress?.({ event: 'scanned' });
        lastStatus = 'scanned';
      }
    } else if (lastStatus !== 'waiting') {
      onProgress?.({ event: 'waiting' });
      lastStatus = 'waiting';
    }

    await sleep(QR_POLL_MS, signal);
  }

  throw new QrTimeoutError(qrCode.sessionId);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
  });
}
