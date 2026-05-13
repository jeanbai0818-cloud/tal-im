import { getBotToken } from '../../core/auth/bot/token.js';
import { OAPI_BASE } from '../../core/shared/constants.js';
import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';
import { YachApiError } from '../../core/oapi/errors.js';

export type RobotGroupInfo = {
  group_tid: string;
  group_name?: string;
  group_owner?: string;
  group_type?: number;
  [key: string]: unknown;
};

export type GroupMember = {
  uuid: string;
  name: string;
  pic?: string;
  group_users_type?: number;
  [key: string]: unknown;
};

type Creds = { appKey: string; appSecret: string; baseUrl?: string };

function base(creds: Creds): string {
  return creds.baseUrl ?? OAPI_BASE;
}

async function postForm<T>(
  creds: Creds,
  path: string,
  params: Record<string, string>,
  context: string,
): Promise<T> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(
    `${base(creds)}${path}?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    },
  );
  return parseOapiJson<T>(res, context);
}

/** 获取机器人所在群列表（GET /openapi/v2/dify/robot/groups）*/
export async function listRobotGroups(creds: Creds): Promise<RobotGroupInfo[]> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(
    `${base(creds)}/openapi/v2/dify/robot/groups?access_token=${encodeURIComponent(token)}`,
  );
  const text = await res.text();
  let parsed: { code?: unknown; data?: unknown; obj?: unknown };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new Error(`[yach-group] listRobotGroups JSON parse error: ${text.slice(0, 300)}`);
  }
  const code = Number(parsed.code ?? 0);
  if (code !== 0 && code !== 200) {
    throw new YachApiError(`[yach-group] listRobotGroups failed (code=${code})`, code);
  }
  const payload = parsed.data ?? (parsed.obj as { groups?: RobotGroupInfo[] } | undefined)?.groups ?? parsed.obj ?? [];
  return (Array.isArray(payload) ? payload : []) as RobotGroupInfo[];
}

/** 创建群（POST /group/create）*/
export async function createGroup(
  creds: Creds,
  params: { name: string; ownerUserId: string; memberUserIds?: string[] },
): Promise<{ group_id: string; name: string }> {
  const members = params.memberUserIds?.length
    ? params.memberUserIds.join('|')
    : params.ownerUserId;
  return postForm<{ group_id: string; name: string }>(
    creds, '/group/create',
    { group_name: params.name, group_owner: params.ownerUserId, group_userids: members },
    'createGroup',
  );
}

/** 添加群成员（POST /group/users/add）*/
export async function addGroupMembers(
  creds: Creds,
  groupId: string,
  userIds: string[],
  opUid: string,
): Promise<void> {
  await postForm<unknown>(
    creds, '/group/users/add',
    { group_tid: groupId, userid_list: JSON.stringify(userIds), op_uid: opUid },
    'addGroupMembers',
  );
}

/** 删除群成员（POST /group/users/del）*/
export async function removeGroupMembers(
  creds: Creds,
  groupId: string,
  userIds: string[],
  opUid: string,
): Promise<void> {
  await postForm<unknown>(
    creds, '/group/users/del',
    { group_tid: groupId, userid_list: JSON.stringify(userIds), op_uid: opUid },
    'removeGroupMembers',
  );
}

/** 获取群成员列表（POST /group/users/list）*/
export async function listGroupMembers(
  creds: Creds,
  groupId: string,
): Promise<{ list: GroupMember[]; total: string }> {
  const result = await postForm<{ list?: GroupMember[]; total?: string }>(
    creds, '/group/users/list',
    { group_tid: groupId },
    'listGroupMembers',
  );
  return { list: result.list ?? [], total: result.total ?? '0' };
}
