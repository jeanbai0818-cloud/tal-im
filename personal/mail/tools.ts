import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getMailSession } from './auth.js';
import { sendMail, listInbox, searchMails, type MailMessage } from './client.js';

function formatMsg(m: MailMessage, index: number): string {
  const date = m.receivedAt
    ? new Date(m.receivedAt * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    : '（时间未知）';
  const attach = m.hasAttachments ? ' [附件]' : '';
  return `${index + 1}. 【${m.subject}${attach}】 来自: ${m.from}  ${date}`;
}

export function registerMailTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_mail_send',
    label: '知音楼发送邮件',
    description: '以当前登录用户身份发送邮件（需已完成扫码登录）。支持多收件人和抄送。',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: '收件人邮箱，多个地址用英文分号或换行分隔',
        },
        subject: { type: 'string', description: '邮件主题' },
        body: { type: 'string', description: '邮件正文（纯文本）' },
        cc: {
          type: 'string',
          description: '抄送地址，多个地址用英文分号或换行分隔（可选）',
        },
      },
      required: ['to', 'subject', 'body'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { to: string; subject: string; body: string; cc?: string };
      try {
        const parseAddrs = (raw: string) =>
          raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
        const session = await getMailSession();
        await sendMail(session, parseAddrs(p.to), p.subject, p.body, p.cc ? parseAddrs(p.cc) : []);
        return textResult(`✅ 邮件已发送至 ${p.to}`, null);
      } catch (err) {
        return textResult(`发送邮件失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_mail_inbox',
    label: '知音楼查看收件箱',
    description: '列出当前登录用户的最新收件箱邮件（需已完成扫码登录）。',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回条数，默认 20，最大 50' },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { limit?: number };
      try {
        const session = await getMailSession();
        const msgs = await listInbox(session, Math.min(p.limit ?? 20, 50));
        if (msgs.length === 0) return textResult('收件箱为空', null);
        const lines = msgs.map((m, i) => formatMsg(m, i));
        return textResult(`收件箱（${msgs.length} 封）:\n${lines.join('\n')}`, null);
      } catch (err) {
        return textResult(`查看收件箱失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_mail_search',
    label: '知音楼搜索邮件',
    description: '在当前登录用户的邮箱中按主题关键字搜索邮件（需已完成扫码登录）。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '搜索关键字（匹配邮件主题）' },
        limit: { type: 'number', description: '返回条数，默认 20' },
      },
      required: ['keyword'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { keyword: string; limit?: number };
      try {
        const session = await getMailSession();
        const msgs = await searchMails(session, p.keyword, p.limit ?? 20);
        if (msgs.length === 0) return textResult(`未找到主题含 "${p.keyword}" 的邮件`, null);
        const lines = msgs.map((m, i) => formatMsg(m, i));
        return textResult(`搜索结果（${msgs.length} 封）:\n${lines.join('\n')}`, null);
      } catch (err) {
        return textResult(`搜索邮件失败: ${String(err)}`, null);
      }
    },
  });
}
