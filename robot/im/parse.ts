import type { YachHistoryRecord, YachReceiveMessage } from './types.js';

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: '图片', file: '文件', video: '视频', audio: '语音', media: '媒体',
};

export function resolveMessageBody(message: YachReceiveMessage): string {
  if (message.msgtype === 'start_new_session') return '/new';

  if (message.msgtype === 'audio' && message.audio_text) {
    return message.audio_text;
  }

  if (message.msgtype === 'image' && message.image_recognize_code === 200 && message.image_text) {
    try {
      const parsed = JSON.parse(message.image_text) as Array<{ texts: string }>;
      return parsed.map((p) => p.texts).join('\n');
    } catch {
      return '';
    }
  }

  return (message.content || '').replace(/<at id="([^"]+)"><\/at>/g, '@$1');
}

export function stripBotMention(text: string, botName?: string): string {
  if (botName) {
    const displayName = botName.replace(/\(.*\)$/, '').trim();
    const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`^(@${escaped}\\s*)+`, 'u'), '').trim();
  }
  return text.replace(/^(@\S+\s*)*/u, '').trim();
}

export function parseHistoryChatRecord(raw: YachHistoryRecord[] | string | undefined): YachHistoryRecord[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function resolveHistoryEntryBody(r: YachHistoryRecord): string {
  const label = MEDIA_TYPE_LABELS[r.type];
  if (label) return r.content ? `[${label}: ${r.content}]` : `[${label}]`;
  return r.content || '';
}
