import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { listActiveAccounts } from '../../core/shared/account.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import {
  readDocMarkdown, readDocText, appendDoc, createDoc, deleteDoc, addCollaborator, getDocUrl,
  type DocLocator, type DocType,
} from './client.js';

function resolveToolAccount(): ResolvedYachAccount {
  const cfg = getYachRuntime().config.loadConfig();
  const accounts = listActiveAccounts(cfg);
  if (accounts.length === 0) throw new Error('没有可用的知音楼账号，请先完成配置');
  return accounts[0];
}

function resolveLocator(p: { file_url?: string; guid?: string; kn_node_id?: string }): DocLocator {
  if (!p.file_url && !p.guid && !p.kn_node_id) {
    throw new Error('请提供 file_url、guid 或 kn_node_id 之一');
  }
  return { fileUrl: p.file_url, guid: p.guid, knNodeId: p.kn_node_id };
}

export function registerDocsTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_doc_read',
    label: '知音楼文档读取（机器人）',
    description:
      '以机器人身份读取知音楼文档内容，支持纯文本和 Markdown 两种格式。' +
      '通过文档 URL、GUID 或知识库节点 ID 定位文档。',
    parameters: {
      type: 'object',
      properties: {
        file_url: { type: 'string', description: '文档完整 URL（与 guid/kn_node_id 三选一）' },
        guid: { type: 'string', description: '文档 GUID（与 file_url/kn_node_id 三选一）' },
        kn_node_id: { type: 'string', description: '知识库节点 ID（与 file_url/guid 三选一）' },
        format: {
          type: 'string',
          enum: ['text', 'markdown'],
          description: '返回格式：text=纯文本（默认）/ markdown=保留格式',
        },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { file_url?: string; guid?: string; kn_node_id?: string; format?: 'text' | 'markdown' };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const loc = resolveLocator(p);
        const content = p.format === 'markdown'
          ? await readDocMarkdown(creds, loc)
          : await readDocText(creds, loc);
        if (!content) return textResult('文档内容为空', null);
        return textResult(content, null);
      } catch (err) {
        return textResult(`读取文档失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_doc_append',
    label: '知音楼文档追加内容（机器人）',
    description: '以机器人身份向知音楼文档末尾追加内容。通过文档 URL、GUID 或知识库节点 ID 定位目标文档。',
    parameters: {
      type: 'object',
      properties: {
        file_url: { type: 'string', description: '文档完整 URL（与 guid/kn_node_id 三选一）' },
        guid: { type: 'string', description: '文档 GUID（与 file_url/kn_node_id 三选一）' },
        kn_node_id: { type: 'string', description: '知识库节点 ID（与 file_url/guid 三选一）' },
        content: { type: 'string', description: '要追加的文本内容' },
      },
      required: ['content'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { file_url?: string; guid?: string; kn_node_id?: string; content: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const loc = resolveLocator(p);
        await appendDoc(creds, loc, p.content);
        return textResult('✅ 内容已追加到文档', null);
      } catch (err) {
        return textResult(`追加文档内容失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_doc_create',
    label: '知音楼创建文档（机器人）',
    description: '以机器人身份在知音楼创建新文档或文件夹，返回文档 GUID 和访问 URL。',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['newdoc', 'folder', 'mosheet', 'presentation', 'mindmap', 'form', 'board'],
          description: '文档类型：newdoc=普通文档（默认）/ folder=文件夹 / mosheet=表格 / presentation=演示 / mindmap=脑图 / form=表单 / board=白板',
        },
        name: { type: 'string', description: '文档名称（可选）' },
        folder: { type: 'string', description: '父文件夹 GUID 或 URL（可选，不填则创建在根目录）' },
      },
      required: ['type'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { type: DocType; name?: string; folder?: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const result = await createDoc(creds, { type: p.type, name: p.name, folder: p.folder });
        return textResult(`✅ 文档已创建\nGUID: ${result.guid}\nURL: ${result.url}`, null);
      } catch (err) {
        return textResult(`创建文档失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_doc_delete',
    label: '知音楼删除文档（机器人）',
    description: '以机器人身份删除知音楼文档。需要提供文档完整 URL（不可恢复，请谨慎使用）。',
    parameters: {
      type: 'object',
      properties: {
        file_url: { type: 'string', description: '文档完整 URL' },
      },
      required: ['file_url'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { file_url: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        await deleteDoc(creds, p.file_url);
        return textResult('✅ 文档已删除', null);
      } catch (err) {
        return textResult(`删除文档失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_doc_add_collaborator',
    label: '知音楼文档添加协作者（机器人）',
    description: '以机器人身份为知音楼文档添加协作者，可指定查看/编辑/管理权限。',
    parameters: {
      type: 'object',
      properties: {
        guid: { type: 'string', description: '文档 GUID' },
        work_code: { type: 'string', description: '被授权用户的工号' },
        role: {
          type: 'string',
          enum: ['viewer', 'editor', 'manager'],
          description: '权限角色：viewer=查看（默认）/ editor=编辑 / manager=管理',
        },
      },
      required: ['guid', 'work_code'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { guid: string; work_code: string; role?: 'viewer' | 'editor' | 'manager' };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        await addCollaborator(creds, p.guid, p.work_code, p.role ?? 'viewer');
        return textResult(`✅ 已将工号 ${p.work_code} 添加为文档协作者（权限: ${p.role ?? 'viewer'}）`, null);
      } catch (err) {
        return textResult(`添加协作者失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_doc_url',
    label: '知音楼获取文档链接（机器人）',
    description: '通过文档 GUID 获取知音楼文档的可访问 URL。',
    parameters: {
      type: 'object',
      properties: {
        guid: { type: 'string', description: '文档 GUID' },
      },
      required: ['guid'],
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as { guid: string };
      try {
        const account = resolveToolAccount();
        const creds = { appKey: account.appKey!, appSecret: account.appSecret!, baseUrl: account.baseUrl };
        const url = await getDocUrl(creds, p.guid);
        if (!url) return textResult('未获取到文档 URL', null);
        return textResult(url, null);
      } catch (err) {
        return textResult(`获取文档 URL 失败: ${String(err)}`, null);
      }
    },
  });
}
