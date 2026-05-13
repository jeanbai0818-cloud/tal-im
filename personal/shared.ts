import { getYachRuntime } from '../core/channel/runtime.js';
import { listActiveAccounts } from '../core/shared/account.js';
import { OAPI_BASE } from '../core/shared/constants.js';
import { loadIdentity } from '../core/session/identity.js';

export type PersonalCreds = {
  token: string;
  baseUrl: string;
  userId: string;
  workcode: string;
  name: string;
};

/**
 * 从已保存的扫码登录 session 中解析个人凭证。
 * 若未登录则抛出可展示给用户的错误。
 */
export async function resolvePersonalCreds(): Promise<PersonalCreds> {
  const identity = await loadIdentity();
  if (!identity) {
    throw new Error('未找到知音楼个人登录凭证，请先完成扫码登录（openclaw yach-aio login）');
  }
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  const baseUrl = accounts[0]?.baseUrl ?? OAPI_BASE;
  return {
    token: identity.token,
    baseUrl,
    userId: identity.userId,
    workcode: identity.workcode,
    name: identity.name,
  };
}
