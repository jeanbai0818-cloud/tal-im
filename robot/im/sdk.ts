/**
 * Channel SDK 传输层：AppKey/AppSecret 长连接消息接收。
 *
 * 使用 TalMsgClient SDK 建立长连接，监听 recvMsg 事件收取消息。
 * 断线重连策略：指数退避 5s → 10s → 20s → ... 上限 5 分钟。
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-runtime';

import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { DEFAULT_CHANNEL_APP_ID } from '../../core/shared/constants.js';
import { handleInboundMessage } from './handler.js';
import type { YachReceiveMessage, Logger } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// TalMsgClient SDK vendor types
type ClientInstance = { unInit(): void };
type ChannelInstance = ClientInstance & {
  init(bizId: string, options: { userId: string; auth?: { params: Map<string, string> } }): number;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
};
type ClientConstructor = {
  new(appId: string, appVersion?: string): { getInstance(type: number): ClientInstance; setSdkConfig(cfg: unknown): void };
  readonly CHANNEL: number;
  getVersion(): string;
};

const CHANNEL_CONFIG = {
  bizId: '97',
  proxy: { protocol: 'https', hostname: 'chatconf.msg.xescdn.com', port: 443, url: '/v4/proxy/config' },
  logServer: { protocol: 'https', hostname: 'log.xescdn.com', port: 443, url: '/log' },
} as const;

const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
const NET_STATUS_CONNECTED = 2;
const NET_DISCONNECT_STATUS = new Set([1, 2, 5]);

function loadSdk(): ClientConstructor {
  // Compiled output lives at dist/robot/im/ → ../../../ reaches plugin install root
  const sdkPath = join(__dirname, '..', '..', '..', 'old', 'yach', 'src', 'vendor', 'tal-msg-sdk', 'index.cjs');
  return require(sdkPath) as ClientConstructor;
}

export function monitorChannel(options: {
  account: ResolvedYachAccount;
  cfg: OpenClawConfig;
  logger: Logger;
}): () => void {
  const { account, cfg, logger } = options;
  const accountId = account.accountId;

  if (!account.appKey || !account.appSecret) {
    logger.error(`[yach-channel] account ${accountId} has no appKey/appSecret, cannot start`);
    return () => {};
  }

  let TalMsgClient: ClientConstructor;
  try {
    TalMsgClient = loadSdk();
    logger.info(`[yach-channel] SDK version: ${TalMsgClient.getVersion()}`);
  } catch (err) {
    logger.error(`[yach-channel][${accountId}] failed to load SDK: ${String(err)}`);
    return () => {};
  }

  const appId = account.config.channelAppId ?? DEFAULT_CHANNEL_APP_ID;
  let sdkClient: ReturnType<ClientConstructor['prototype']['constructor']>;
  let channel: ChannelInstance;
  try {
    sdkClient = new TalMsgClient(appId, '1.0.0');
    sdkClient.setSdkConfig({
      proxyConfig: CHANNEL_CONFIG.proxy,
      remoteLogConfig: CHANNEL_CONFIG.logServer,
      extra: { location: 'China', logLevel: 'warn' },
    });
    channel = sdkClient.getInstance(TalMsgClient.CHANNEL) as ChannelInstance;
  } catch (err) {
    logger.error(`[yach-channel][${accountId}] failed to create SDK client: ${String(err)}`);
    return () => {};
  }

  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let failCount = 0;

  function reconnectDelay(): number {
    return Math.min(RECONNECT_BASE_MS * Math.pow(2, failCount), RECONNECT_MAX_MS);
  }

  function scheduleReconnect(reason: string): void {
    if (stopped || reconnectTimer !== null) return;
    failCount += 1;
    const delay = reconnectDelay();
    logger.warn(`[yach-channel][${accountId}] ${reason}, reconnecting in ${delay}ms (attempt ${failCount})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) doInit(true);
    }, delay);
  }

  function doInit(isReconnect = false): void {
    if (isReconnect) {
      try { channel.unInit(); } catch (err) {
        logger.warn(`[yach-channel][${accountId}] unInit before reconnect: ${String(err)}`);
      }
    }
    try {
      const result = channel.init(CHANNEL_CONFIG.bizId, {
        userId: account.appKey!,
        auth: { params: new Map([['app_key', account.appKey!], ['app_secret', account.appSecret!]]) },
      });
      logger.info(`[yach-channel][${accountId}] ${isReconnect ? 're' : ''}init result: ${result}`);
    } catch (err) {
      logger.error(`[yach-channel][${accountId}] init threw: ${String(err)}`);
      scheduleReconnect('init threw');
    }
  }

  const onNetStatus = (data: unknown): void => {
    try {
      const raw = data !== null && typeof data === 'object' ? data as Record<string, unknown> : {};
      const status = typeof raw['netStatus'] === 'number' ? raw['netStatus']
        : typeof raw['status'] === 'number' ? raw['status'] : undefined;
      if (status === NET_STATUS_CONNECTED) {
        if (failCount > 0) { failCount = 0; logger.info(`[yach-channel][${accountId}] reconnected`); }
        return;
      }
      if (status !== undefined && NET_DISCONNECT_STATUS.has(status)) {
        scheduleReconnect(`netStatus=${status}`);
      }
    } catch (err) {
      logger.error(`[yach-channel][${accountId}] onNetStatus error: ${String(err)}`);
    }
  };

  const onRecvMsg = (data: unknown): void => {
    logger.info(`[yach-channel][${accountId}] recvMsg received`);
    try {
      const envelope = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>;
      const inner = envelope['data'];
      const message = (typeof inner === 'string' ? JSON.parse(inner) : inner) as YachReceiveMessage;
      void handleInboundMessage({ message, account, cfg, logger });
    } catch (err) {
      logger.error(`[yach-channel][${accountId}] failed to handle recvMsg: ${String(err)}`);
    }
  };

  const onKickout = (data: unknown): void => {
    logger.warn(`[yach-channel][${accountId}] kicked out: ${JSON.stringify(data)}`);
    scheduleReconnect('kicked out');
  };

  const onAuthResponse = (data: unknown): void => {
    const raw = data as { code?: number } | null;
    if (raw?.code !== 0) {
      logger.error(`[yach-channel][${accountId}] auth failed (code=${raw?.code}): check appKey/appSecret`);
      try { channel.unInit(); } catch { /* ignore */ }
      scheduleReconnect('auth error');
    } else {
      logger.info(`[yach-channel][${accountId}] auth ok`);
    }
  };

  channel.on('netStatusChange', onNetStatus);
  channel.on('authResponse', onAuthResponse);
  channel.on('kickout', onKickout);
  channel.on('recvMsg', onRecvMsg);

  doInit(false);

  return () => {
    stopped = true;
    if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    logger.info(`[yach-channel][${accountId}] stopping...`);
    try { channel.unInit(); } catch (err) {
      logger.error(`[yach-channel][${accountId}] unInit error: ${String(err)}`);
    }
  };
}
