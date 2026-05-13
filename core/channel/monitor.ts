import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-runtime';

import type { ResolvedYachAccount } from '../shared/types.js';
import { monitorChannel } from '../../robot/im/sdk.js';

type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type MonitorOptions = {
  account: ResolvedYachAccount;
  cfg: OpenClawConfig;
  logger: Logger;
  statusSink?: (patch: Record<string, unknown>) => void;
};

export function monitorSingleAccount(opts: MonitorOptions): () => void {
  const { account, logger } = opts;
  const connectionMode = account.config.connectionMode ?? 'channel';

  logger.info(`[yach] account ${account.accountId} starting in ${connectionMode} mode`);

  if (connectionMode === 'channel') {
    return monitorChannel({ account, cfg: opts.cfg, logger });
  }

  // webhook mode: connections are inbound, nothing to start
  logger.info(`[yach][${account.accountId}] webhook mode — waiting for inbound requests`);
  return () => {};
}
