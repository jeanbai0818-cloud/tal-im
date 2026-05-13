import { createReplyPrefixContext } from 'openclaw/plugin-sdk/channel-runtime';
import { resolveSenderCommandAuthorization } from 'openclaw/plugin-sdk/command-auth';
import { isNormalizedSenderAllowed } from 'openclaw/plugin-sdk/allow-from';
import { buildAgentMediaPayload } from 'openclaw/plugin-sdk/media-runtime';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/config-runtime';
import type { ReplyPayload } from 'openclaw/plugin-sdk/reply-payload';

import { getYachRuntime } from '../../core/channel/runtime.js';
import type { ResolvedYachAccount } from '../../core/shared/types.js';
import { sendImMessage } from './oapi.js';
import { resolveMessageBody, stripBotMention, parseHistoryChatRecord, resolveHistoryEntryBody } from './parse.js';
import type { YachInboundCtx, YachConversationType } from './types.js';

function resolveTarget(chatId: string): { toId: string; conversationType: YachConversationType } {
  if (chatId.startsWith('group:')) {
    return { toId: chatId.slice(6), conversationType: '2' };
  }
  return { toId: chatId.startsWith('user:') ? chatId.slice(5) : chatId, conversationType: '1' };
}

export async function dispatchInboundMessage(params: {
  ctx: YachInboundCtx;
  account: ResolvedYachAccount;
  cfg: OpenClawConfig;
}): Promise<void> {
  const { ctx, account, cfg } = params;
  const {
    senderId, conversationId, msgId, senderName, senderTag,
    conversationType: _ct, isGroup, chatId, toId, message,
  } = ctx;

  const core = getYachRuntime();
  const effectiveCfg = core.config.loadConfig();

  const route = core.channel.routing.resolveAgentRoute({
    cfg: effectiveCfg,
    channel: 'yach',
    accountId: account.appKey!,
    peer: { kind: isGroup ? 'group' : 'direct', id: toId },
  });

  const rawBody = isGroup
    ? stripBotMention(resolveMessageBody(message), message.chatbotUserName)
    : resolveMessageBody(message);

  const inboundHistory = (() => {
    if (!account.config.chatHistoryEnabled) return undefined;
    const history = parseHistoryChatRecord(message.historyChatRecord as string | undefined);
    const limit = account.config.chatHistoryLimit ?? 20;
    if (!history.length) return undefined;
    return history.slice(-limit).map((r) => ({
      sender: r.senderName,
      body: resolveHistoryEntryBody(r),
      timestamp: r.time,
    }));
  })();

  const fromUser = senderId;
  const sendToUser = isGroup ? `group:${conversationId}` : `user:${senderId}`;

  const yachCfg = account.config;
  const dmPolicy = yachCfg.dmPolicy ?? 'pairing';
  const configuredAllowFrom = [
    ...(yachCfg.allowFrom ?? []).map(String),
    ...(!isGroup && dmPolicy === 'open' ? [senderId] : []),
  ];
  const configuredGroupAllowFrom = (() => {
    if (!isGroup) return undefined;
    const combined = (yachCfg.commandAllowFrom ?? []).map(String);
    if (combined.length > 0) return combined;
    return yachCfg.groupPolicy === 'open' ? ['*'] : [];
  })();

  const { commandAuthorized } = await resolveSenderCommandAuthorization({
    cfg,
    rawBody,
    isGroup,
    dmPolicy,
    configuredAllowFrom,
    configuredGroupAllowFrom,
    senderId,
    isSenderAllowed: (id, allowFrom) => isNormalizedSenderAllowed({ senderId: id, allowFrom }),
    readAllowFromStore: () =>
      core.channel.pairing
        .readAllowFromStore({ channel: 'yach', accountId: account.accountId })
        .catch(() => [] as string[]),
    shouldComputeCommandAuthorized: core.channel.commands.shouldComputeCommandAuthorized,
    resolveCommandAuthorizedFromAuthorizers: core.channel.commands.resolveCommandAuthorizedFromAuthorizers,
  });

  if (commandAuthorized === false) return;

  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
  const envelopeFrom = isGroup ? `${conversationId}:${senderId}` : senderId;
  let messageBody = rawBody;
  if (message.replyMsgId) messageBody = `[Replying to: ${message.replyContent}]\n\n${rawBody}`;
  messageBody = `${senderName}: ${messageBody}`;

  const body = core.channel.reply.formatAgentEnvelope({
    channel: 'Yach',
    from: envelopeFrom,
    timestamp: new Date(),
    envelope: envelopeOptions,
    body: messageBody,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: rawBody,
    InboundHistory: inboundHistory,
    RawBody: rawBody,
    CommandBody: rawBody,
    CommandAuthorized: commandAuthorized,
    From: fromUser,
    To: sendToUser,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    Provider: 'yach' as const,
    Surface: 'yach' as const,
    ChatType: isGroup ? 'group' : 'direct',
    GroupSubject: isGroup ? conversationId : undefined,
    SenderName: senderName || senderId,
    SenderTag: senderTag,
    SenderId: senderId,
    MessageSid: msgId,
    ReplyToBody: message.replyContent ?? undefined,
    Timestamp: Date.now(),
    OriginatingChannel: 'yach' as const,
    OriginatingTo: sendToUser,
    OwnerAllowFrom: isGroup ? [] : [senderId],
    ...buildAgentMediaPayload([]),
  });

  const prefixContext = createReplyPrefixContext({ cfg: effectiveCfg, agentId: route.agentId });
  const textChunkLimit = core.channel.text.resolveTextChunkLimit(
    effectiveCfg, 'yach', account.appKey, { fallbackLimit: 4_000 },
  );
  const chunkMode = core.channel.text.resolveChunkMode(effectiveCfg, 'yach');
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: effectiveCfg, channel: 'yach', accountId: account.appKey,
  });

  const { toId: targetId, conversationType: targetType } = resolveTarget(chatId);

  const preview = rawBody.replace(/\s+/g, ' ').slice(0, 160);
  core.system.enqueueSystemEvent(
    `Yach[${account.accountId}] ${isGroup ? `group ${conversationId}` : `DM ${senderId}`}: ${preview}`,
    { sessionKey: route.sessionKey, contextKey: `yach:message:${toId}:${msgId}` },
  );

  const { dispatcher, replyOptions, markDispatchIdle } =
    core.channel.reply.createReplyDispatcherWithTyping({
      responsePrefix: prefixContext.responsePrefix,
      responsePrefixContextProvider: prefixContext.responsePrefixContextProvider,
      humanDelay: core.channel.reply.resolveHumanDelayConfig(effectiveCfg, route.agentId),
      onReplyStart: () => {},
      onIdle: async () => {},
      onCleanup: () => {},
      // TODO: add streaming card + typing indicator in robot/im/stream.ts
      deliver: async (payload: ReplyPayload) => {
        const rawText = payload.text ?? '';
        if (!rawText.trim()) return;
        const converted = core.channel.text.convertMarkdownTables(rawText, tableMode);
        for (const chunk of core.channel.text.chunkTextWithMode(converted, textChunkLimit, chunkMode)) {
          await sendImMessage({
            appKey: account.appKey!,
            appSecret: account.appSecret!,
            baseUrl: account.baseUrl,
            toId: targetId,
            conversationType: targetType,
            payload: { msgtype: 'markdown', markdown: { title: chunk.slice(0, 50), text: chunk } },
          });
        }
      },
      onError: async (err) => {
        console.error('[yach] reply error: ' + String(err));
      },
    });

  try {
    await core.channel.reply.withReplyDispatcher({
      dispatcher,
      onSettled: () => { markDispatchIdle(); },
      run: () => core.channel.reply.dispatchReplyFromConfig({
        ctx: ctxPayload,
        cfg: effectiveCfg,
        dispatcher,
        replyOptions: {
          ...replyOptions,
          onModelSelected: prefixContext.onModelSelected,
          disableBlockStreaming: true,
        },
      }),
    });
  } catch (err) {
    console.error('[yach] dispatch error: ' + String(err));
  }
}
