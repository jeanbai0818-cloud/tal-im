import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';
import type { PersonalCreds } from '../shared.js';

export type OkrKr = { id: number; title: string };
export type OkrObject = { id: number; object: string; krs: OkrKr[] };
export type OkrContent = { title: string; content: OkrObject[] };
export type OkrUser = { user_id: string; work_code: string; name: string };

export type OkrListItem = {
  id: string;
  user: OkrUser;
  okr: OkrContent;
};

export type OkrListParams = {
  query_type?: 'person' | 'department';
  query_value?: string;
  start_month?: string;
  end_month?: string;
  sort?: 'asc' | 'desc';
  next_page?: string;
};

/** 查询 OKR 列表（POST /openapi/v2/okr/list）*/
export async function listOkr(
  creds: PersonalCreds,
  params: OkrListParams,
): Promise<{ list: OkrListItem[]; next_page: string }> {
  const body: Record<string, unknown> = { access_token: creds.token };
  if (params.query_type) body.query_type = params.query_type;
  if (params.query_value) body.query_value = params.query_value;
  if (params.start_month) body.start_month = params.start_month;
  if (params.end_month) body.end_month = params.end_month;
  if (params.sort) body.sort = params.sort;
  if (params.next_page) body.next_page = params.next_page;

  const res = await oapiFetch(`${creds.baseUrl}/openapi/v2/okr/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseOapiJson<{ list?: OkrListItem[]; next_page?: string }>(res, 'listOkr');
  return { list: data.list ?? [], next_page: data.next_page ?? '' };
}
