import { getBotToken } from '../../core/auth/bot/token.js';
import { OAPI_BASE } from '../../core/shared/constants.js';
import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';

export type UserInfo = {
  userId: string;
  workCode: string;
  name: string;
  nameEn?: string;
  email?: string;
  mobile?: string;
  deptName?: string;
  avatar?: string;
};

type Creds = { appKey: string; appSecret: string; baseUrl?: string };

function base(creds: Creds): string {
  return creds.baseUrl ?? OAPI_BASE;
}

/** 按 userId 获取用户详情（GET /user/get?access_token=&userid=） */
export async function getUserById(creds: Creds, userId: string): Promise<UserInfo> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const url = `${base(creds)}/user/get?access_token=${encodeURIComponent(token)}&userid=${encodeURIComponent(userId)}`;
  const res = await oapiFetch(url);
  return parseOapiJson<UserInfo>(res, `getUserById(${userId})`);
}

/** 按工号获取用户详情（GET /user/get_by_workcode?access_token=&work_code=） */
export async function getUserByWorkCode(creds: Creds, workCode: string): Promise<UserInfo> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const url = `${base(creds)}/user/get_by_workcode?access_token=${encodeURIComponent(token)}&work_code=${encodeURIComponent(workCode)}`;
  const res = await oapiFetch(url);
  return parseOapiJson<UserInfo>(res, `getUserByWorkCode(${workCode})`);
}

type RawSearchResult = {
  name: string;
  name_en?: string;
  work_code: string;
  userid: string;
  deptName?: string;
};

/** 按关键字搜索用户（POST /openapi/v2/user/search） */
export async function searchUsers(creds: Creds, keyword: string): Promise<UserInfo[]> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(`${base(creds)}/openapi/v2/user/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, keyword }),
  });
  const raw = await parseOapiJson<RawSearchResult[]>(res, `searchUsers(${keyword})`);
  return (Array.isArray(raw) ? raw : []).map((u) => ({
    userId: u.userid,
    workCode: u.work_code,
    name: u.name,
    nameEn: u.name_en,
    deptName: u.deptName,
  }));
}
