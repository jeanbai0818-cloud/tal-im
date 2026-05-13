import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import {
  loadSnapshot, searchContacts, searchDepts, listDeptMembers, getPeers, snapshotAge,
  type ContactRecord, type OrgNode,
} from './client.js';

function formatContact(c: ContactRecord): string {
  const parts = [`${c.name}（工号: ${c.workcode}）`];
  if (c.dept) parts.push(`部门: ${c.dept}`);
  if (c.position) parts.push(`职位: ${c.position}`);
  return parts.join(' | ');
}

function formatDept(n: OrgNode): string {
  return `${n.name}（ID: ${n.deptId}${n.memberCount != null ? `，${n.memberCount} 人` : ''}）路径: ${n.path}`;
}

export function registerOrgTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_org_search',
    label: '知音楼通讯录搜索',
    description:
      '从本地通讯录快照中搜索员工（按姓名、工号、部门关键字）。' +
      '若快照不存在，提示用户先执行 `openclaw yach-aio contacts sync` 同步通讯录。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键字（姓名、工号或部门名称）' },
        limit: { type: 'number', description: '返回条数上限，默认 20' },
      },
      required: ['query'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { query: string; limit?: number };
      try {
        const snap = await loadSnapshot();
        if (!snap) {
          return textResult(
            '本地通讯录快照不存在，请先运行: openclaw yach-aio contacts sync',
            null,
          );
        }
        const results = await searchContacts(p.query, p.limit ?? 20);
        if (results.length === 0) return textResult(`未找到与 "${p.query}" 相关的员工`, null);
        const lines = results.map((c, i) => `${i + 1}. ${formatContact(c)}`);
        return textResult(
          `找到 ${results.length} 名员工（快照: ${snapshotAge(snap)}）:\n${lines.join('\n')}`,
          null,
        );
      } catch (err) {
        return textResult(`搜索失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_org_dept',
    label: '知音楼部门查询',
    description: '按部门名称关键字查询部门列表，或按部门 ID 列出该部门的直属成员。',
    parameters: {
      type: 'object',
      properties: {
        dept_query: {
          type: 'string',
          description: '部门名称关键字，用于搜索部门列表（与 dept_id 二选一）',
        },
        dept_id: {
          type: 'string',
          description: '部门 ID，用于列出该部门直属成员（与 dept_query 二选一）',
        },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { dept_query?: string; dept_id?: string };
      if (!p.dept_query && !p.dept_id) {
        return textResult('请提供 dept_query（搜索部门名称）或 dept_id（列出部门成员）', null);
      }
      try {
        const snap = await loadSnapshot();
        if (!snap) {
          return textResult(
            '本地通讯录快照不存在，请先运行: openclaw yach-aio contacts sync',
            null,
          );
        }
        if (p.dept_id) {
          const members = await listDeptMembers(p.dept_id);
          if (members.length === 0) return textResult(`部门 ${p.dept_id} 无成员或 ID 不存在`, null);
          const lines = members.map((c, i) => `${i + 1}. ${formatContact(c)}`);
          return textResult(`部门 ${p.dept_id} 共 ${members.length} 名成员:\n${lines.join('\n')}`, null);
        }
        const depts = await searchDepts(p.dept_query!);
        if (depts.length === 0) return textResult(`未找到名称含 "${p.dept_query}" 的部门`, null);
        const lines = depts.map((n, i) => `${i + 1}. ${formatDept(n)}`);
        return textResult(`找到 ${depts.length} 个部门:\n${lines.join('\n')}`, null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_org_peers',
    label: '知音楼同事查询',
    description: '按姓名或工号查找某人，并列出其同部门的同事列表。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '姓名或工号（精确匹配）' },
        limit: { type: 'number', description: '返回同事条数上限，默认 20' },
      },
      required: ['query'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { query: string; limit?: number };
      try {
        const snap = await loadSnapshot();
        if (!snap) {
          return textResult(
            '本地通讯录快照不存在，请先运行: openclaw yach-aio contacts sync',
            null,
          );
        }
        const { person, peers } = await getPeers(p.query, p.limit ?? 20);
        if (!person) return textResult(`未找到 "${p.query}"，请使用精确姓名或工号`, null);
        const lines = [
          `本人: ${formatContact(person)}`,
          `同部门同事（${peers.length} 人）:`,
          ...peers.map((c, i) => `  ${i + 1}. ${formatContact(c)}`),
        ];
        return textResult(lines.join('\n'), null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });
}
