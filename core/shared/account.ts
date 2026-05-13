import type { OpenClawConfig } from 'openclaw/plugin-sdk/plugin-entry';
import { DEFAULT_ACCOUNT_ID, OAPI_BASE } from './constants.js';
import type { YachAccountConfig, ResolvedYachAccount } from './types.js';

function getPluginConfig(cfg: OpenClawConfig): YachAccountConfig {
  return ((cfg.channels as Record<string, unknown>)?.yach ?? {}) as YachAccountConfig;
}

function mergeAccountConfig(
  base: YachAccountConfig,
  override: Omit<YachAccountConfig, 'accounts'>,
): Omit<YachAccountConfig, 'accounts'> {
  const { accounts: _accounts, ...baseFlat } = base;
  return { ...baseFlat, ...override };
}

/** List all configured account IDs for the yach channel. */
export function listAccountIds(cfg: OpenClawConfig): string[] {
  const pluginCfg = getPluginConfig(cfg);
  const extra = Object.keys(pluginCfg.accounts ?? {});
  return extra.length > 0 ? [DEFAULT_ACCOUNT_ID, ...extra] : [DEFAULT_ACCOUNT_ID];
}

/** Resolve the default account ID — always the constant default unless overridden. */
export function resolveDefaultAccountId(_cfg: OpenClawConfig): string {
  return DEFAULT_ACCOUNT_ID;
}

/** Resolve a single account, merging plugin-level and account-level config. */
export function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedYachAccount {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const pluginCfg = getPluginConfig(cfg);
  const accountOverride = id === DEFAULT_ACCOUNT_ID
    ? {}
    : (pluginCfg.accounts?.[id] ?? {});
  const merged = mergeAccountConfig(pluginCfg, accountOverride);

  return {
    accountId: id,
    name: merged.name,
    enabled: merged.enabled !== false,
    configured: Boolean(merged.appKey && merged.appSecret),
    appKey: merged.appKey,
    appSecret: merged.appSecret,
    baseUrl: merged.baseUrl ?? OAPI_BASE,
    config: merged,
  };
}

/** Look up an account by its AppKey (bot ID). */
export function resolveAccountByAppKey(
  cfg: OpenClawConfig,
  appKey: string,
): ResolvedYachAccount | undefined {
  return listAccountIds(cfg)
    .map((id) => resolveAccount(cfg, id))
    .find((a) => a.appKey === appKey);
}

/** List all enabled + configured accounts. */
export function listActiveAccounts(cfg: OpenClawConfig): ResolvedYachAccount[] {
  return listAccountIds(cfg)
    .map((id) => resolveAccount(cfg, id))
    .filter((a) => a.enabled && a.configured);
}

/** Patch the yach channel config section with a partial update. */
export function patchChannelConfig(
  cfg: OpenClawConfig,
  patch: Partial<YachAccountConfig>,
  accountId?: string | null,
): OpenClawConfig {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const pluginCfg = getPluginConfig(cfg);

  if (id === DEFAULT_ACCOUNT_ID) {
    return { ...cfg, channels: { ...cfg.channels, yach: { ...pluginCfg, ...patch } } };
  }

  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      yach: {
        ...pluginCfg,
        accounts: { ...pluginCfg.accounts, [id]: { ...pluginCfg.accounts?.[id], ...patch } },
      },
    },
  };
}
