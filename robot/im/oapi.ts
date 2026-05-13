import { getBotToken } from '../../core/auth/bot/token.js';
import { OAPI_BASE } from '../../core/shared/constants.js';
import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';
import { YachApiError } from '../../core/oapi/errors.js';
import type { YachConversationType, YachMessagePayload, YachAtTarget } from './types.js';

export type ImMessage = {
  senderName: string;
  uuid: string;
  content: string;
  time: number;
  type: string;
  workCode: string;
  userType: number;
  [key: string]: unknown;
};

export type GroupInfoDetail = {
  group_tid: string;
  group_name: string;
  group_icon?: string;
  group_users_count: string;
  group_owner: string;
  [key: string]: unknown;
};

type Creds = { appKey: string; appSecret: string; baseUrl?: string };

function base(creds: Creds): string {
  return creds.baseUrl ?? OAPI_BASE;
}

export type ImSendParams = {
  appKey: string;
  appSecret: string;
  baseUrl?: string;
  toId: string;
  conversationType: YachConversationType;
  payload: YachMessagePayload;
  toWorkCode?: string;
  at?: YachAtTarget;
};

/** 发送 IM 消息（单聊或群聊）。返回 yachMid 字符串，保留大整数精度。*/
export async function sendImMessage(params: ImSendParams): Promise<string | undefined> {
  const { appKey, appSecret, baseUrl = OAPI_BASE, toId, conversationType, payload, toWorkCode, at } = params;
  const token = await getBotToken(appKey, appSecret, baseUrl);
  const isGroup = conversationType === '2';

  const messageObj: Record<string, unknown> = { ...payload };
  if (isGroup && at && (at.isAtAll || at.atMobiles?.length || at.atWorkCodes?.length)) {
    messageObj.at = {
      atMobiles: at.atMobiles ?? [],
      atWorkCodes: at.atWorkCodes ?? [],
      isAtAll: at.isAtAll ?? false,
    };
  }
  const message = JSON.stringify(messageObj);

  let url: string;
  let body: URLSearchParams;

  if (isGroup) {
    url = `${baseUrl}/group/robot/message/send?access_token=${token}`;
    body = new URLSearchParams({ group_id: toId, message });
  } else if (toWorkCode) {
    url = `${baseUrl}/v1/single/message/send?access_token=${token}`;
    body = new URLSearchParams({ to_work_code: toWorkCode, message });
  } else {
    url = `${baseUrl}/v1/single/message/send?access_token=${token}`;
    body = new URLSearchParams({ to_user_id: toId, message });
  }

  const res = await oapiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const resultText = await res.text();
  const result = JSON.parse(resultText) as { code: number; msg?: string };

  if (!res.ok) throw new Error(`[yach-im] sendMessage HTTP ${res.status}`);
  if (result.code !== 200) {
    throw new YachApiError(`[yach-im] sendMessage code=${result.code}: ${resultText}`, result.code);
  }

  // Extract yachMid from raw text to preserve large integer precision
  const match = resultText.match(/"yachMid"\s*:\s*(\d+)/);
  return match ? match[1] : undefined;
}

/** 查询群聊历史消息（GET /openapi/v2/im/messages）*/
export async function getImMessages(
  creds: Creds,
  params: {
    groupId: string;
    startTime: number;
    endTime: number;
    pageSize?: number;
    descending?: boolean;
    pageToken?: string;
  },
): Promise<{ messages: ImMessage[]; hasMore: boolean; pageToken: string }> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const qs = new URLSearchParams({
    access_token: token,
    group_id: params.groupId,
    start_time: String(params.startTime),
    end_time: String(params.endTime),
    page_size: String(params.pageSize ?? 50),
  });
  if (params.descending !== undefined) qs.set('descending', String(params.descending));
  if (params.pageToken) qs.set('page_token', params.pageToken);

  const res = await oapiFetch(`${base(creds)}/openapi/v2/im/messages?${qs}`);
  const data = await parseOapiJson<{
    messages?: ImMessage[];
    page_info?: { page_token?: string; has_more?: boolean };
  }>(res, 'getImMessages');
  return {
    messages: data.messages ?? [],
    hasMore: data.page_info?.has_more ?? false,
    pageToken: data.page_info?.page_token ?? '',
  };
}

/** 撤回消息（POST /openapi/v2/msg/recall）*/
export async function recallImMessage(creds: Creds, yachMid: string): Promise<void> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(`${base(creds)}/openapi/v2/msg/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, yach_mid: yachMid }),
  });
  await parseOapiJson(res, `recallImMessage(${yachMid})`);
}

/** 获取群基本信息（POST /group/info）*/
export async function getImGroupInfo(
  creds: Creds,
  groupId: string,
): Promise<{ group: GroupInfoDetail; uidlist: string[] }> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(
    `${base(creds)}/group/info?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ group_tid: groupId }).toString(),
    },
  );
  return parseOapiJson<{ group: GroupInfoDetail; uidlist: string[] }>(res, `getImGroupInfo(${groupId})`);
}
