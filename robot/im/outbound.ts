import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import type { ChannelOutboundAdapter } from 'openclaw/plugin-sdk/channel-send-result';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import { resolveAccount, resolveAccountByAppKey } from '../../core/shared/account.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { sendImMessage } from './oapi.js';
import type { YachConversationType, YachMessagePayload } from './types.js';

function resolveOutboundAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedYachAccount {
  if (accountId) {
    const byAppKey = resolveAccountByAppKey(cfg, accountId);
    if (byAppKey) return byAppKey;
  }
  return resolveAccount(cfg, accountId ?? undefined);
}

function requireCredentials(account: ResolvedYachAccount): { appKey: string; appSecret: string; baseUrl: string } {
  if (!account.appKey || !account.appSecret) {
    throw new Error(`[yach-im] account ${account.accountId} missing appKey/appSecret`);
  }
  return { appKey: account.appKey, appSecret: account.appSecret, baseUrl: account.baseUrl };
}

function isWorkCode(id: string): boolean {
  return !/^yach/i.test(id) && !(/^\d+$/.test(id) && id.length > 6);
}

function resolveTarget(to: string): { toId: string; conversationType: YachConversationType; toWorkCode?: string } {
  if (to.startsWith('group:')) {
    return { toId: to.slice(6), conversationType: '2' };
  }
  if (to.startsWith('work_code:')) {
    return { toId: '', conversationType: '1', toWorkCode: to.slice(10) };
  }
  const id = to.startsWith('user:') ? to.slice(5) : to;
  if (isWorkCode(id)) {
    return { toId: '', conversationType: '1', toWorkCode: id };
  }
  return { toId: id, conversationType: '1' };
}

function parseAtMentions(text: string): { atMobiles: string[]; atWorkCodes: string[]; isAtAll: boolean } | undefined {
  const atMobiles: string[] = [];
  const atWorkCodes: string[] = [];
  let isAtAll = false;

  for (const [, id] of text.matchAll(/@(\S+)/g)) {
    if (id === 'all' || id === '所有人') {
      isAtAll = true;
    } else if (/^1\d{10}$/.test(id)) {
      atMobiles.push(id);
    } else if (isWorkCode(id)) {
      atWorkCodes.push(id);
    }
  }

  if (!isAtAll && atMobiles.length === 0 && atWorkCodes.length === 0) return undefined;
  return { atMobiles, atWorkCodes, isAtAll };
}

function detectMediaKind(filePath: string): 'image' | 'video' | 'file' | 'audio' {
  const ext = extname(filePath).toLowerCase().slice(1);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['amr', 'acc', 'm4a', 'mp3'].includes(ext)) return 'audio';
  return 'file';
}

function detectContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
    '.pdf': 'application/pdf', '.zip': 'application/zip',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function cosUpload(params: {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  filename: string;
  data: Buffer;
  contentType: string;
  cosType: 'file' | 'image';
}): Promise<string> {
  // TODO: implement COS upload in robot/im/cos.ts once needed
  throw new Error('[yach-im] COS upload not yet implemented in new robot/im layer — media send unavailable');
}

async function getAudioDuration(_filePath: string): Promise<number> {
  // TODO: implement audio duration extraction
  return 0;
}

export const yachOutbound: ChannelOutboundAdapter = {
  deliveryMode: 'direct',
  chunkerMode: 'markdown',
  textChunkLimit: 4_000,
  chunker: (text, limit) => getYachRuntime().channel.text.chunkMarkdownText(text, limit),

  sendText: async ({ cfg, to, text, accountId }: { cfg: OpenClawConfig; to: string; text: string; accountId?: string | null }) => {
    const account = resolveOutboundAccount(cfg, accountId);
    const { appKey, appSecret, baseUrl } = requireCredentials(account);
    const { toId, conversationType, toWorkCode } = resolveTarget(to);
    const at = conversationType === '2' ? parseAtMentions(text) : undefined;
    const messageId = await sendImMessage({
      appKey, appSecret, baseUrl, toId, conversationType, toWorkCode,
      payload: { msgtype: 'markdown', markdown: { title: text.slice(0, 50), text } },
      at,
    });
    return { channel: 'yach', messageId: messageId ?? '' };
  },

  sendMedia: async ({ cfg, to, text, mediaUrl, accountId }: { cfg: OpenClawConfig; to: string; text?: string | null; mediaUrl?: string | null; accountId?: string | null }) => {
    const account = resolveOutboundAccount(cfg, accountId);
    const { appKey, appSecret, baseUrl } = requireCredentials(account);
    const { toId, conversationType, toWorkCode } = resolveTarget(to);

    if (text?.trim()) {
      await sendImMessage({
        appKey, appSecret, baseUrl, toId, conversationType, toWorkCode,
        payload: { msgtype: 'text', text: { content: text } },
      });
    }

    if (mediaUrl) {
      const kind = detectMediaKind(mediaUrl);
      const filename = basename(mediaUrl) || 'file';
      const contentType = detectContentType(mediaUrl);
      const data = await readFile(mediaUrl);
      const cosType = kind === 'file' ? 'file' : 'image';

      const cosUrl = await cosUpload({ baseUrl, appKey, appSecret, filename, data, contentType, cosType });

      let payload: YachMessagePayload;
      if (kind === 'image') {
        payload = { msgtype: 'image', image: { url: cosUrl, file_name: filename } };
      } else if (kind === 'video') {
        payload = { msgtype: 'video', video: { name: filename, url: cosUrl } };
      } else if (kind === 'audio') {
        payload = { msgtype: 'audio', audio: { duration: await getAudioDuration(mediaUrl), url: cosUrl, size: data.length } };
      } else {
        payload = { msgtype: 'file', file: { name: filename, url: cosUrl, size: data.length.toString() } };
      }

      const messageId = await sendImMessage({
        appKey, appSecret, baseUrl, toId, conversationType, toWorkCode, payload,
      });
      return { channel: 'yach', messageId: messageId ?? '' };
    }

    return { channel: 'yach', messageId: '' };
  },
};
