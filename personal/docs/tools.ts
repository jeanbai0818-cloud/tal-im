import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { resolvePersonalCreds } from '../shared.js';
import { readDocMarkdown, readDocText, appendDoc } from './client.js';

function resolveLocator(p: { file_url?: string; guid?: string; kn_node_id?: string }) {
  if (!p.file_url && !p.guid && !p.kn_node_id) {
    throw new Error('请提供 file_url、guid 或 kn_node_id 之一');
  }
  return { fileUrl: p.file_url, guid: p.guid, knNodeId: p.kn_node_id };
}

export function registerDocsTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'yach_personal_doc_read',
    label: '知音楼文档读取',
    description:
      '以当前登录用户身份读取知音楼文档内容（需已完成扫码登录）。' +
      '支持纯文本和 Markdown 两种格式。通过文档 URL、GUID 或知识库节点 ID 定位文档。',
    parameters: {
      type: 'object',
      properties: {
        file_url: { type: 'string', description: '文档完整 URL（与 guid/kn_node_id 三选一）' },
        guid: { type: 'string', description: '文档 GUID（与 file_url/kn_node_id 三选一）' },
        kn_node_id: { type: 'string', description: '知识库节点 ID（与 file_url/guid 三选一）' },
        format: {
          type: 'string',
          enum: ['text', 'markdown'],
          description: '返回格式：text=纯文本（默认）/ markdown=保留 Markdown 格式',
        },
      },
    },
    async execute(_toolCallId: string, rawParams: unknown) {
      const p = rawParams as {
        file_url?: string;
        guid?: string;
        kn_node_id?: string;
        format?: 'text' | 'markdown';
      };
      try {
        const loc = resolveLocator(p);
        const creds = await resolvePersonalCreds();
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
    name: 'yach_personal_doc_append',
    label: '知音楼文档追加内容',
    description:
      '以当前登录用户身份向知音楼文档末尾追加内容（需已完成扫码登录）。' +
      '通过文档 URL、GUID 或知识库节点 ID 定位目标文档。',
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
      const p = rawParams as {
        file_url?: string;
        guid?: string;
        kn_node_id?: string;
        content: string;
      };
      try {
        const loc = resolveLocator(p);
        const creds = await resolvePersonalCreds();
        await appendDoc(creds, loc, p.content);
        return textResult('✅ 内容已追加到文档', null);
      } catch (err) {
        return textResult(`追加文档内容失败: ${String(err)}`, null);
      }
    },
  });
}
