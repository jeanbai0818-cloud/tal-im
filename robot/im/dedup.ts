const DEFAULT_TTL_MS = 12 * 60 * 60 * 1_000; // 12 小时
const DEFAULT_MAX_ENTRIES = 5_000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1_000;
const DEFAULT_EXPIRY_MS = 30 * 60 * 1_000; // 消息过期：30 分钟

/** 消息是否已过期（太旧不处理）。createAt 为毫秒级 Unix 时间戳字符串。*/
export function isMessageExpired(createAt: string | undefined, expiryMs = DEFAULT_EXPIRY_MS): boolean {
  if (!createAt) return false;
  const ts = parseInt(createAt, 10);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > expiryMs;
}

/** FIFO 去重，断线重连后防重复投递。*/
export class MessageDedup {
  private store = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private sweepTimer: ReturnType<typeof setInterval>;

  constructor(opts: { ttlMs?: number; maxEntries?: number } = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
  }

  tryRecord(id: string, scope?: string): boolean {
    const key = scope ? `${scope}:${id}` : id;
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing !== undefined) {
      if (now - existing < this.ttlMs) return false;
      this.store.delete(key);
    }

    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, now);
    return true;
  }

  get size(): number { return this.store.size; }
  clear(): void { this.store.clear(); }

  private sweep(): void {
    const now = Date.now();
    for (const [key, ts] of this.store) {
      if (now - ts < this.ttlMs) break;
      this.store.delete(key);
    }
  }
}

const dedups = new Map<string, MessageDedup>();

export function getMessageDedup(accountId: string): MessageDedup {
  let d = dedups.get(accountId);
  if (!d) {
    d = new MessageDedup();
    dedups.set(accountId, d);
  }
  return d;
}
