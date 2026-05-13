import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import { sendImMessage, getImMessages, recallImMessage, getImGroupInfo, type ImMessage } from './oapi.js';

function resolveToolCreds() {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  const acc = accounts[0];
  if (!acc.appKey || !acc.appSecret) throw new Error('账号缺少 appKey/appSecret');
  return { appKey: acc.appKey, appSecret: acc.appSecret, baseUrl: acc.baseUrl };
}

function parseToUnixSeconds(dateStr: string, label: string): number {
  const ts = Date.parse(dateStr);
  if (Number.isNaN(ts)) {
    throw new Error(`${label} 日期格式无效: "${dateStr}"，请使用 ISO 8601 格式（如 "2025-06-15T09:00:00+08:00"）`);
  }
  return Math.floor(ts / 1_000);
}

function formatDateTime(unix: number): string {
  return new Date(unix * 1_000).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatMessage(m: ImMessage): string {
  return `[${formatDateTime(m.time)}] ${m.senderName}（${m.workCode}）: ${m.content}`;
}

export function registerImTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_im_send',
    label: '知音楼机器人发消息',
    description:
      '以机器人身份向知音楼发送消息（单聊或群聊）。支持纯文本和 Markdown 格式。' +
      '发送成功返回消息 ID（yachMid），可用于后续撤回。',
    parameters: {
      type: 'object',
      properties: {
        conv_type: { type: 'string', enum: ['1', '2'], description: '会话类型：1=单聊 2=群聊' },
        to_id: { type: 'string', description: '接收者用户 ID（单聊）或群 ID（群聊）' },
        msgtype: { type: 'string', enum: ['text', 'markdown'], description: '消息类型：text（默认）或 markdown' },
        content: { type: 'string', description: '消息正文（必填）' },
        title: { type: 'string', description: 'Markdown 标题（msgtype=markdown 时必填）' },
        to_work_code: { type: 'string', description: '单聊时按工号发送（与 to_id 二选一）' },
        at_all: { type: 'boolean', description: '群聊时 @所有人（可选）' },
        at_work_codes: { type: 'array', items: { type: 'string' }, description: '群聊时 @指定工号列表（可选）' },
      },
      required: ['conv_type', 'content'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as {
        conv_type: '1' | '2';
        to_id?: string;
        msgtype?: 'text' | 'markdown';
        content: string;
        title?: string;
        to_work_code?: string;
        at_all?: boolean;
        at_work_codes?: string[];
      };
      if (!p.to_id && !p.to_work_code) return textResult('to_id 或 to_work_code 必填其一', null);
      const msgtype = p.msgtype ?? 'text';
      if (msgtype === 'markdown' && !p.title) return textResult('msgtype=markdown 时 title 为必填', null);
      try {
        const creds = resolveToolCreds();
        const payload = msgtype === 'markdown'
          ? { msgtype: 'markdown' as const, markdown: { title: p.title!, text: p.content } }
          : { msgtype: 'text' as const, text: { content: p.content } };
        const yachMid = await sendImMessage({
          ...creds,
          toId: p.to_id ?? '',
          conversationType: p.conv_type,
          payload,
          toWorkCode: p.to_work_code,
          at: p.conv_type === '2' ? {
            isAtAll: p.at_all,
            atWorkCodes: p.at_work_codes,
          } : undefined,
        });
        return textResult(`✅ 消息已发送${yachMid ? `，消息 ID: ${yachMid}` : ''}`, null);
      } catch (err) {
        return textResult(`发送失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_im_recall',
    label: '知音楼撤回消息',
    description: '撤回知音楼消息。需要消息 ID（yachMid），来自 yach_im_send 返回值。',
    parameters: {
      type: 'object',
      properties: {
        yach_mid: { type: 'string', description: '要撤回的消息 ID（yachMid）' },
      },
      required: ['yach_mid'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const { yach_mid } = rawParams as { yach_mid: string };
      try {
        const creds = resolveToolCreds();
        await recallImMessage(creds, yach_mid);
        return textResult(`✅ 消息 ${yach_mid} 已撤回`, null);
      } catch (err) {
        return textResult(`撤回失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_im_history',
    label: '知音楼群聊消息历史',
    description: '查询知音楼群聊的历史消息记录，按时间范围分页拉取。',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: '群 ID' },
        start_time: { type: 'string', description: '开始时间，ISO 8601，如 "2025-06-15T09:00:00+08:00"' },
        end_time: { type: 'string', description: '结束时间，ISO 8601，如 "2025-06-15T18:00:00+08:00"' },
        page_size: { type: 'number', description: '每页条数，默认 50，最大 50' },
        page_token: { type: 'string', description: '分页令牌（从上一页响应中获取）' },
      },
      required: ['group_id', 'start_time', 'end_time'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as {
        group_id: string;
        start_time: string;
        end_time: string;
        page_size?: number;
        page_token?: string;
      };
      try {
        const creds = resolveToolCreds();
        const startTime = parseToUnixSeconds(p.start_time, 'start_time');
        const endTime = parseToUnixSeconds(p.end_time, 'end_time');
        const { messages, hasMore, pageToken } = await getImMessages(creds, {
          groupId: p.group_id,
          startTime,
          endTime,
          pageSize: Math.min(p.page_size ?? 50, 50),
          pageToken: p.page_token,
        });
        if (messages.length === 0) return textResult('该时间段内无消息', null);
        const lines = messages.map(formatMessage);
        let text = `共 ${messages.length} 条消息:\n\n${lines.join('\n')}`;
        if (hasMore) text += `\n\n（还有更多，下页令牌: ${pageToken}）`;
        return textResult(text, null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_im_group_info',
    label: '知音楼群信息',
    description: '查询知音楼群聊的基本信息（群名称、群主、成员数、成员列表）。',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: '群 ID' },
      },
      required: ['group_id'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const { group_id } = rawParams as { group_id: string };
      try {
        const creds = resolveToolCreds();
        const { group, uidlist } = await getImGroupInfo(creds, group_id);
        const lines = [
          `群名称: ${group.group_name}`,
          `群 ID: ${group.group_tid}`,
          `群主: ${group.group_owner}`,
          `成员数: ${group.group_users_count}`,
          uidlist.length > 0 ? `成员列表: ${uidlist.join(', ')}` : '',
        ].filter(Boolean);
        return textResult(lines.join('\n'), null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });
}
