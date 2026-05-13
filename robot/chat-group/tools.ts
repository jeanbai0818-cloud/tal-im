import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import {
  listRobotGroups,
  createGroup,
  addGroupMembers,
  removeGroupMembers,
  listGroupMembers,
} from './client.js';

function resolveToolCreds() {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  const acc = accounts[0];
  if (!acc.appKey || !acc.appSecret) throw new Error('账号缺少 appKey/appSecret');
  return { appKey: acc.appKey, appSecret: acc.appSecret, baseUrl: acc.baseUrl };
}

export function registerChatGroupTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_group_list_robot_groups',
    label: '机器人所在群列表',
    description:
      '获取当前机器人所在的所有群聊列表，返回群 ID（group_tid）和群名称。' +
      '需要向群发送消息时可先调用此工具获取群 ID。',
    parameters: {
      type: 'object',
      properties: {},
    },
    async execute(_toolCallId: string, _rawParams: unknown) {
      try {
        const creds = resolveToolCreds();
        const groups = await listRobotGroups(creds);
        if (groups.length === 0) return textResult('机器人当前未加入任何群聊', null);
        const lines = groups.map(
          (g, i) => `${i + 1}. ${g.group_name ?? '（无名称）'}（ID: ${g.group_tid}）`,
        );
        return textResult(`机器人所在群（共 ${groups.length} 个）:\n${lines.join('\n')}`, null);
      } catch (err) {
        return textResult(`查询失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_group_create',
    label: '知音楼创建群',
    description: '创建知音楼群聊。需要指定群名称、群主 userId，可选预添加成员列表。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '群名称' },
        owner_user_id: { type: 'string', description: '群主的知音楼用户 ID' },
        member_user_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '初始成员用户 ID 列表（可选，自动包含群主）',
        },
      },
      required: ['name', 'owner_user_id'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { name: string; owner_user_id: string; member_user_ids?: string[] };
      try {
        const creds = resolveToolCreds();
        const result = await createGroup(creds, {
          name: p.name,
          ownerUserId: p.owner_user_id,
          memberUserIds: p.member_user_ids,
        });
        const lines = [
          `✅ 群已创建`,
          `群名称: ${result.name ?? p.name}`,
          `群 ID: ${result.group_id}`,
        ];
        return textResult(lines.join('\n'), null);
      } catch (err) {
        return textResult(`创建群失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_group_add_members',
    label: '知音楼群添加成员',
    description: '向知音楼群聊添加成员。需要群 ID、要添加的用户 ID 列表和操作者 userId。',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: '群 ID' },
        user_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '要添加的用户 ID 列表',
        },
        op_uid: { type: 'string', description: '操作者的知音楼用户 ID（需要有管理权限）' },
      },
      required: ['group_id', 'user_ids', 'op_uid'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { group_id: string; user_ids: string[]; op_uid: string };
      if (p.user_ids.length === 0) return textResult('user_ids 不能为空', null);
      try {
        const creds = resolveToolCreds();
        await addGroupMembers(creds, p.group_id, p.user_ids, p.op_uid);
        return textResult(`✅ 已向群 ${p.group_id} 添加 ${p.user_ids.length} 名成员`, null);
      } catch (err) {
        return textResult(`添加成员失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_group_remove_members',
    label: '知音楼群移除成员',
    description: '从知音楼群聊移除成员。需要群 ID、要移除的用户 ID 列表和操作者 userId。',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: '群 ID' },
        user_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '要移除的用户 ID 列表',
        },
        op_uid: { type: 'string', description: '操作者的知音楼用户 ID（需要有管理权限）' },
      },
      required: ['group_id', 'user_ids', 'op_uid'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { group_id: string; user_ids: string[]; op_uid: string };
      if (p.user_ids.length === 0) return textResult('user_ids 不能为空', null);
      try {
        const creds = resolveToolCreds();
        await removeGroupMembers(creds, p.group_id, p.user_ids, p.op_uid);
        return textResult(`✅ 已从群 ${p.group_id} 移除 ${p.user_ids.length} 名成员`, null);
      } catch (err) {
        return textResult(`移除成员失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_group_list_members',
    label: '知音楼群成员列表',
    description: '查询知音楼群聊的成员列表，返回每名成员的用户 ID 和姓名。',
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
        const { list, total } = await listGroupMembers(creds, group_id);
        if (list.length === 0) return textResult(`群 ${group_id} 暂无成员信息`, null);
        const lines = list.map(
          (m, i) => `${i + 1}. ${m.name}（userId: ${m.uuid}）`,
        );
        return textResult(`群 ${group_id} 共 ${total} 名成员:\n${lines.join('\n')}`, null);
      } catch (err) {
        return textResult(`查询成员失败: ${String(err)}`, null);
      }
    },
  });
}
