import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { getUserById, getUserByWorkCode, searchUsers, type UserInfo } from './client.js';

function resolveToolAccount(): ResolvedYachAccount {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  return accounts[0];
}

function formatUser(u: UserInfo): string {
  const lines = [`姓名: ${u.name}`];
  if (u.nameEn) lines.push(`英文名: ${u.nameEn}`);
  lines.push(`工号: ${u.workCode}`, `userId: ${u.userId}`);
  if (u.deptName) lines.push(`部门: ${u.deptName}`);
  if (u.email) lines.push(`邮箱: ${u.email}`);
  if (u.mobile) lines.push(`手机: ${u.mobile}`);
  return lines.join('\n');
}

export function registerContactsTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_user_search',
    label: '知音楼用户搜索',
    description: '按关键字（姓名、工号、邮箱等）搜索知音楼用户，返回匹配的员工列表。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键字（至少2个字符）' },
      },
      required: ['keyword'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const { keyword } = rawParams as { keyword: string };
      try {
        const account = resolveToolAccount();
        const users = await searchUsers(
          { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl },
          keyword,
        );
        if (users.length === 0) return textResult(`未找到与 "${keyword}" 相关的用户`, null);
        const lines = users.map((u, i) =>
          `${i + 1}. ${u.name}（工号: ${u.workCode}，userId: ${u.userId}${u.deptName ? `，部门: ${u.deptName}` : ''}）`,
        );
        return textResult(`找到 ${users.length} 名用户:\n${lines.join('\n')}`, null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_user_get',
    label: '知音楼用户详情',
    description: '按 userId 或工号精确查询知音楼用户详细信息（姓名、部门、邮箱等）。userId 和 workCode 二选一。',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '知音楼用户 ID（yachXXXXX 或17位纯数字）' },
        workCode: { type: 'string', description: '员工工号' },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const { userId, workCode } = rawParams as { userId?: string; workCode?: string };
      if (!userId && !workCode) return textResult('请提供 userId 或 workCode（二选一）', null);
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const user = userId
          ? await getUserById(creds, userId)
          : await getUserByWorkCode(creds, workCode!);
        return textResult(formatUser(user), null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });
}
