import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { listSchedules, createSchedule, cancelSchedule, getSchedule, type ScheduleItem } from './client.js';

function resolveToolAccount(): ResolvedYachAccount {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  return accounts[0];
}

function parseToUnixSeconds(dateStr: string, label: string): number {
  const ts = Date.parse(dateStr);
  if (Number.isNaN(ts)) {
    throw new Error(`${label} 日期格式无效: "${dateStr}"，请使用 ISO 8601 格式（如 "2025-06-01T09:00:00"）`);
  }
  return Math.floor(ts / 1_000);
}

function formatDateTime(unix: number): string {
  return new Date(unix * 1_000).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatSchedule(s: ScheduleItem): string {
  const lines = [
    `标题: ${s.title}`,
    `时间: ${formatDateTime(s.beginTime)} → ${formatDateTime(s.finishTime)}`,
  ];
  if (s.address) lines.push(`地点: ${s.address}`);
  if (s.remark) lines.push(`备注: ${s.remark}`);
  if (s.participantNum) lines.push(`参与人数: ${s.participantNum}`);
  lines.push(`日程ID: ${s.scheduleId}`);
  return lines.join('\n');
}

export function registerCalendarTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_schedule_list',
    label: '知音楼日程列表',
    description: '查询知音楼日程列表。返回指定时间段内的日程，支持按工号筛选。',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: '开始时间，ISO 8601，如 "2025-06-01T00:00:00"' },
        endDate: { type: 'string', description: '结束时间，ISO 8601，如 "2025-06-30T23:59:59"' },
        workCodes: { type: 'array', items: { type: 'string' }, description: '按工号筛选（可选，最多10个）' },
        includeAll: { type: 'boolean', description: '是否包含已取消和已拒绝的日程，默认 false' },
      },
      required: ['startDate', 'endDate'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { startDate: string; endDate: string; workCodes?: string[]; includeAll?: boolean };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const startTime = parseToUnixSeconds(p.startDate, 'startDate');
        const endTime = parseToUnixSeconds(p.endDate, 'endDate');
        const schedules = await listSchedules(creds, {
          startTime, endTime,
          workCodes: p.workCodes,
          hasCancel: p.includeAll ? 1 : 0,
          hasRefuse: p.includeAll ? 1 : 0,
          hasSelf: 1,
        });
        if (schedules.length === 0) return textResult(`${p.startDate} 至 ${p.endDate} 期间无日程`, null);
        const parts = schedules.map((s, i) => `--- 日程 ${i + 1} ---\n${formatSchedule(s)}`);
        return textResult(`共 ${schedules.length} 条日程:\n\n${parts.join('\n\n')}`, null);
      } catch (err) {
        return textResult(`查询日程失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_schedule_create',
    label: '知音楼创建日程',
    description: '在知音楼创建日程（会议、提醒等）。成功后返回日程 ID。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '日程标题' },
        startTime: { type: 'string', description: '开始时间，ISO 8601，如 "2025-06-15T14:00:00"' },
        endTime: { type: 'string', description: '结束时间，ISO 8601，如 "2025-06-15T15:00:00"' },
        participants: { type: 'string', description: '参与人的知音楼用户 ID，多个用英文逗号分隔' },
        remark: { type: 'string', description: '日程备注' },
        address: { type: 'string', description: '地点' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { title: string; startTime: string; endTime: string; participants?: string; remark?: string; address?: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const startTs = parseToUnixSeconds(p.startTime, 'startTime');
        const endTs = parseToUnixSeconds(p.endTime, 'endTime');
        if (endTs <= startTs) return textResult('结束时间必须晚于开始时间', null);
        const eventId = await createSchedule(creds, {
          title: p.title, startTime: startTs, endTime: endTs,
          participants: p.participants, remark: p.remark, address: p.address,
        });
        const lines = [
          `✅ 日程已创建`,
          `标题: ${p.title}`,
          `时间: ${formatDateTime(startTs)} → ${formatDateTime(endTs)}`,
          p.address ? `地点: ${p.address}` : '',
          `日程 ID: ${eventId}`,
        ].filter(Boolean);
        return textResult(lines.join('\n'), null);
      } catch (err) {
        return textResult(`创建日程失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_schedule_cancel',
    label: '知音楼取消日程',
    description: '取消/删除知音楼日程。需要日程 ID（来自 yach_schedule_list 或 yach_schedule_create 返回值）。',
    parameters: {
      type: 'object',
      properties: {
        scheduleId: { type: 'string', description: '要取消的日程 ID' },
      },
      required: ['scheduleId'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const { scheduleId } = rawParams as { scheduleId: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        await cancelSchedule(creds, scheduleId);
        return textResult(`✅ 日程 ${scheduleId} 已取消`, null);
      } catch (err) {
        return textResult(`取消日程失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_schedule_get',
    label: '知音楼日程详情',
    description: '查询单条知音楼日程的详细信息。',
    parameters: {
      type: 'object',
      properties: {
        scheduleId: { type: 'string', description: '日程 ID' },
      },
      required: ['scheduleId'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const { scheduleId } = rawParams as { scheduleId: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const schedule = await getSchedule(creds, scheduleId);
        return textResult(formatSchedule(schedule), null);
      } catch (err) {
        return textResult(`查询日程失败: ${String(err)}`, null);
      }
    },
  });
}
