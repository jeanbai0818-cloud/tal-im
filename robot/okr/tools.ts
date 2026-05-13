import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { listOkr, type OkrListItem } from './client.js';

const MONTH_RE = /^\d{4}-\d{2}$/;

function resolveToolAccount(): ResolvedYachAccount {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  return accounts[0];
}

function formatOkrItem(item: OkrListItem, index: number): string {
  const lines: string[] = [
    `--- OKR ${index + 1} | ${item.user.name}（工号: ${item.user.work_code}）---`,
  ];
  if (item.okr.title) lines.push(`标题: ${item.okr.title}`);
  for (const obj of item.okr.content ?? []) {
    lines.push(`  O: ${obj.object}`);
    for (const kr of obj.krs ?? []) {
      lines.push(`    KR: ${kr.title}`);
    }
  }
  return lines.join('\n');
}

export function registerOkrTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_okr_list',
    label: '知音楼 OKR 查询（机器人）',
    description:
      '以机器人身份查询任意人员或部门的知音楼 OKR 列表。' +
      '支持按工号或部门 ID 筛选，支持月份范围和分页。',
    parameters: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['person', 'department'],
          description: '筛选类型：person=按人员工号 / department=按部门 ID',
        },
        query_value: {
          type: 'string',
          description: '筛选值（query_type 存在时必填）：人员工号或部门 ID',
        },
        start_month: {
          type: 'string',
          description: '开始月份，格式 YYYY-MM，如 "2026-01"',
        },
        end_month: {
          type: 'string',
          description: '结束月份，格式 YYYY-MM，如 "2026-04"',
        },
        sort: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: '排序方式，默认 desc',
        },
        next_page: {
          type: 'string',
          description: '分页令牌（从上一页 next_page 字段获取）',
        },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as {
        query_type?: 'person' | 'department';
        query_value?: string;
        start_month?: string;
        end_month?: string;
        sort?: 'asc' | 'desc';
        next_page?: string;
      };

      if (p.query_type && !p.query_value) {
        return textResult(`参数错误：query_type="${p.query_type}" 时 query_value 必填`, null);
      }
      if (p.start_month && !MONTH_RE.test(p.start_month)) {
        return textResult(`start_month 格式错误 "${p.start_month}"，请使用 YYYY-MM`, null);
      }
      if (p.end_month && !MONTH_RE.test(p.end_month)) {
        return textResult(`end_month 格式错误 "${p.end_month}"，请使用 YYYY-MM`, null);
      }

      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const { list, next_page } = await listOkr(creds, p);
        if (list.length === 0) return textResult('未找到符合条件的 OKR', null);
        const parts = list.map((item, i) => formatOkrItem(item, i));
        let text = `共 ${list.length} 条 OKR:\n\n${parts.join('\n\n')}`;
        if (next_page) text += `\n\n（还有更多，下页令牌: ${next_page}）`;
        return textResult(text, null);
      } catch (err) {
        return textResult(`查询 OKR 失败: ${String(err)}`, null);
      }
    },
  });
}
