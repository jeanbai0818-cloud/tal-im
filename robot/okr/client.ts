import { getBotToken } from '../../core/auth/bot/token.js';
import { OAPI_BASE } from '../../core/shared/constants.js';
import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';

type Creds = { appKey: string; appSecret: string; baseUrl?: string };

export type OkrUser = { user_id: string; work_code: string; name: string };

export type OkrKr = { title: string; [key: string]: unknown };
export type OkrObjective = { object: string; krs?: OkrKr[]; [key: string]: unknown };

export type OkrListItem = {
  id: string;
  user: OkrUser;
  okr: {
    title?: string;
    content?: OkrObjective[];
    [key: string]: unknown;
  };
};

export type OkrListParams = {
  query_type?: 'person' | 'department';
  query_value?: string;
  start_month?: string;
  end_month?: string;
  sort?: 'asc' | 'desc';
  next_page?: string;
};

function base(creds: Creds): string {
  return creds.baseUrl ?? OAPI_BASE;
}

/** 查询 OKR 列表（POST /openapi/v2/okr/list） */
export async function listOkr(
  creds: Creds,
  params: OkrListParams,
): Promise<{ list: OkrListItem[]; next_page: string }> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const body: Record<string, unknown> = { access_token: token };
  if (params.query_type) body.query_type = params.query_type;
  if (params.query_value) body.query_value = params.query_value;
  if (params.start_month) body.start_month = params.start_month;
  if (params.end_month) body.end_month = params.end_month;
  if (params.sort) body.sort = params.sort;
  if (params.next_page) body.next_page = params.next_page;

  const res = await oapiFetch(`${base(creds)}/openapi/v2/okr/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseOapiJson<{ list?: OkrListItem[]; next_page?: string }>(res, 'listOkr');
  return { list: data.list ?? [], next_page: data.next_page ?? '' };
}
