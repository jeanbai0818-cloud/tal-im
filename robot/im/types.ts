/** '1' = 单聊, '2' = 群聊 */
export type YachConversationType = '1' | '2';

export type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export type YachStatusSink = (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;

export type YachHistoryRecord = {
  senderName: string;
  time: number;
  content: string;
  type: string;
};

/** 知音楼 Channel SDK 推送的原始消息结构 */
export type YachReceiveMessage = {
  msgtype: string;
  content: string;
  appID: string;
  msgId: string;
  msgIdClient?: string;
  createAt?: string;
  conversationType?: YachConversationType;
  conversationId: string;
  conversationTitle?: string;
  senderId: string;
  senderNick: string;
  chatbotUserId?: string;
  replyMsgType?: string;
  replyMsgId?: string;
  quoteMsgId?: string;
  replyContent?: string;
  originName?: string;
  userJson?: string;
  chatbotUserName?: string;
  audio_text?: string;
  image_recognize_code?: number;
  image_text?: string;
  historyChatRecord?: string;
  callbackUrl?: string;
  uniqueKey?: string;
  callbackMode?: 'full' | 'streaming';
};

/** AES 解密 + 规范化后的入站消息上下文，贯穿处理流水线 */
export type YachInboundCtx = {
  senderId: string;
  conversationId: string;
  msgId: string;
  senderName: string;
  senderTag?: string;
  conversationType: YachConversationType;
  isGroup: boolean;
  chatId: string;
  toId: string;
  message: YachReceiveMessage;
};

export type YachAtTarget = {
  atMobiles?: string[];
  atWorkCodes?: string[];
  isAtAll?: boolean;
};

export type YachMessagePayload =
  | { msgtype: 'text'; text: { content: string } }
  | { msgtype: 'markdown'; markdown: { title: string; text: string } }
  | { msgtype: 'image'; image: { url: string; file_name?: string; file_size?: string } }
  | { msgtype: 'file'; file: { name: string; url: string; size?: string } }
  | { msgtype: 'video'; video: { name: string; url: string; size?: string } }
  | { msgtype: 'audio'; audio: { duration: number; url: string; size: number } };
