import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { listWeekly, type WeeklyListItem } from './client.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveToolAccount(): ResolvedYachAccount {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  return accounts[0];
}

function formatWeeklyItem(item: WeeklyListItem, index: number): string {
  const w = item.weekly;
  const header = `--- 周报 ${index + 1} | ${item.user.name}（工号: ${item.user.work_code}）| 阅读: ${w.read_count} 点赞: ${w.like_count}${w.is_read ? '' : ' [未读]'} ---`;
  const sections = (w.content ?? []).map((c) => {
    const lines = [`  [${c.okr_title ?? 'OKR'}] ${c.title}`];
    if (c.content) lines.push(`    ${c.content.replace(/\n/g, '\n    ')}`);
    return lines.join('\n');
  });
  return [header, ...sections].join('\n');
}

export function registerWeeklyTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_weekly_list',
    label: '知音楼周报查询（机器人）',
    description:
      '以机器人身份查询任意人员或部门的知音楼周报列表。' +
      '支持按人员、部门、伙伴分组筛选，支持日期范围、未读过滤和分页。',
    parameters: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['person', 'department', 'team_id', 'team_name'],
          description: '筛选类型：person=按工号 / department=按部门 ID / team_id=按分组ID / team_name=按分组名称',
        },
        query_value: {
          type: 'string',
          description: '筛选值（query_type 存在时必填）',
        },
        start_date: {
          type: 'string',
          description: '开始日期，格式 YYYY-MM-DD，如 "2026-04-14"',
        },
        end_date: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD，如 "2026-04-20"',
        },
        unread: {
          type: 'boolean',
          description: '是否只返回未读周报，默认 false',
        },
        sort: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: '排序方式，默认 desc（最新在前）',
        },
        next_page: {
          type: 'string',
          description: '分页令牌（从上一页 next_page 字段获取）',
        },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as {
        query_type?: 'person' | 'department' | 'team_id' | 'team_name';
        query_value?: string;
        start_date?: string;
        end_date?: string;
        unread?: boolean;
        sort?: 'asc' | 'desc';
        next_page?: string;
      };

      if (p.query_type && !p.query_value) {
        return textResult(`参数错误：query_type="${p.query_type}" 时 query_value 必填`, null);
      }
      if (p.start_date && !DATE_RE.test(p.start_date)) {
        return textResult(`start_date 格式错误 "${p.start_date}"，请使用 YYYY-MM-DD`, null);
      }
      if (p.end_date && !DATE_RE.test(p.end_date)) {
        return textResult(`end_date 格式错误 "${p.end_date}"，请使用 YYYY-MM-DD`, null);
      }

      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const { list, next_page } = await listWeekly(creds, p);
        if (list.length === 0) return textResult('未找到符合条件的周报', null);
        const parts = list.map((item, i) => formatWeeklyItem(item, i));
        let text = `共 ${list.length} 条周报:\n\n${parts.join('\n\n')}`;
        if (next_page) text += `\n\n（还有更多，下页令牌: ${next_page}）`;
        return textResult(text, null);
      } catch (err) {
        return textResult(`查询周报失败: ${String(err)}`, null);
      }
    },
  });
}
