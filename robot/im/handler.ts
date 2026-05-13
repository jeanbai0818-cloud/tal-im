import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-runtime';

import { getYachRuntime } from '../../core/channel/runtime.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { aesDecrypt } from './aes.js';
import { isMessageExpired, getMessageDedup } from './dedup.js';
import { dispatchInboundMessage } from './dispatcher.js';
import { sendImMessage } from './oapi.js';
import type { YachReceiveMessage, YachConversationType, YachInboundCtx, Logger } from './types.js';

export type { Logger };

const HANDLED_TYPES = new Set([
  'text', 'audio', 'image', 'file', 'video', 'reply',
  'fold', 'link', 'merge_forward', 'start_new_session', 'callback',
]);

export function shouldHandle(msgtype: string | undefined): boolean {
  return msgtype !== undefined && HANDLED_TYPES.has(msgtype);
}

// Simple per-chat serial queue to prevent concurrent message handling
const chatQueues = new Map<string, Promise<void>>();

function enqueueChatTask(chatKey: string, task: () => Promise<void>): void {
  const prev = chatQueues.get(chatKey) ?? Promise.resolve();
  const next = prev.then(task).catch(() => {});
  chatQueues.set(chatKey, next);
  // Clean up resolved queues to prevent memory leaks
  void next.then(() => {
    if (chatQueues.get(chatKey) === next) chatQueues.delete(chatKey);
  });
}

export async function handleInboundMessage(params: {
  message: YachReceiveMessage;
  account: ResolvedYachAccount;
  cfg: OpenClawConfig;
  logger: Logger;
}): Promise<void> {
  const { message, account, cfg, logger } = params;
  const msgtype = message?.msgtype;

  logger.info(`yach[${account.accountId}]: received ${msgtype} from ${message?.senderId}`);

  if (!shouldHandle(msgtype)) return;

  if (!account.configured || !account.appKey || !account.appSecret) {
    logger.error(`[yach] account ${account.accountId} appKey/appSecret not configured`);
    return;
  }

  if (isMessageExpired(message.createAt)) {
    logger.info(`yach[${account.accountId}]: discarding expired message (createAt=${message.createAt})`);
    return;
  }

  const appKey = account.appKey;

  let senderId: string;
  let conversationId: string;
  let msgId: string;

  try {
    senderId = aesDecrypt(message.senderId, appKey);
    conversationId = message.conversationId ? aesDecrypt(message.conversationId, appKey) : '';
    msgId = message.msgId ? aesDecrypt(message.msgId, appKey) : '';
    if (msgtype === 'file') {
      message.content = aesDecrypt(message.content, appKey);
    }
  } catch (err) {
    logger.error(`[yach] decrypt failed: ${String(err)}`);
    return;
  }

  const dedupKey = msgId || message.msgIdClient;
  if (dedupKey) {
    const dedup = getMessageDedup(account.accountId);
    if (!dedup.tryRecord(dedupKey, account.accountId)) {
      logger.info(`yach[${account.accountId}]: duplicate message dropped (msgId=${dedupKey})`);
      return;
    }
  }

  const conversationType: YachConversationType = message.conversationType === '2' ? '2' : '1';
  const isGroup = conversationType === '2';

  let senderName = message.senderNick || senderId;
  let senderTag: string | undefined;
  if (message.userJson) {
    try {
      const user = JSON.parse(message.userJson) as { name?: string; workCode?: string; deptName?: string };
      if (user.name) senderName = user.name;
      const tagLines: string[] = [];
      if (user.workCode) tagLines.push(`work_code: ${user.workCode}`);
      if (user.name) tagLines.push(`name: ${user.name}`);
      if (user.deptName) tagLines.push(`department: ${user.deptName}`);
      if (tagLines.length > 0) senderTag = tagLines.join('\n');
    } catch { /* ignore */ }
  }

  const toId = isGroup ? conversationId : senderId;

  // Access control
  const accountCfg = account.config;
  if (isGroup) {
    const groupPolicy = accountCfg.groupPolicy ?? 'open';
    if (groupPolicy === 'disabled') {
      logger.info('[yach] group message rejected: groupPolicy=disabled');
      return;
    }
    if (groupPolicy === 'allowlist') {
      const allowed = (accountCfg.groupAllowFrom ?? []).map(String);
      if (!allowed.includes('*') && !allowed.includes(conversationId)) {
        logger.info(`[yach] group ${conversationId} not in groupAllowFrom, ignored`);
        return;
      }
    }
  } else {
    const dmPolicy = accountCfg.dmPolicy ?? 'open';
    if (dmPolicy === 'disabled') {
      logger.info(`[yach] blocked DM sender ${senderId} (dmPolicy=disabled)`);
      return;
    }
    if (dmPolicy !== 'open') {
      const core = getYachRuntime();
      const configAllowFrom = (accountCfg.allowFrom ?? []).map(String);
      const storeAllowFrom = await core.channel.pairing
        .readAllowFromStore({ channel: 'yach', accountId: account.accountId })
        .catch(() => [] as string[]);
      const effectiveAllowFrom = [...configAllowFrom, ...storeAllowFrom];
      const allowed = effectiveAllowFrom.includes('*') || effectiveAllowFrom.includes(senderId);

      if (!allowed) {
        if (dmPolicy === 'pairing') {
          const core2 = getYachRuntime();
          const { code, created } = await core2.channel.pairing.upsertPairingRequest({
            channel: 'yach',
            accountId: account.accountId,
            id: senderId,
            meta: { name: senderName },
          });
          if (created) {
            logger.info(`[yach] pairing request: sender=${senderId} name=${senderName}`);
            const replyText = core2.channel.pairing.buildPairingReply({
              channel: 'yach',
              idLine: `Your Yach user id: ${senderId}`,
              code,
            });
            await sendImMessage({
              appKey,
              appSecret: account.appSecret,
              baseUrl: account.baseUrl,
              toId: senderId,
              conversationType: '1',
              payload: { msgtype: 'text', text: { content: replyText } },
            }).catch((e) => logger.error(`[yach] pairing reply failed: ${String(e)}`));
          }
        } else {
          logger.info(`[yach] blocked unauthorized sender ${senderId} (dmPolicy=${dmPolicy})`);
        }
        return;
      }
    }
  }

  const chatId = isGroup ? `group:${conversationId}` : `user:${senderId}`;
  const ctx: YachInboundCtx = {
    senderId, conversationId, msgId, senderName, senderTag,
    conversationType, isGroup, chatId, toId, message,
  };

  // callback messages are handled separately (no AI dispatch needed)
  if (msgtype === 'callback') {
    logger.info(`[yach] callback message from ${senderId} — TODO: implement callback handling`);
    return;
  }

  enqueueChatTask(`${account.accountId}:${chatId}`, () =>
    dispatchInboundMessage({ ctx, account, cfg }).catch((err) => {
      logger.error(`[yach] dispatchInboundMessage error: ${String(err)}`);
    }),
  );
}
