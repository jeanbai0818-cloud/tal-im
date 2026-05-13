import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';
import type { PersonalCreds } from '../shared.js';

export type WeeklyUser = { user_id: string; work_code: string; name: string };

export type WeeklyContentItem = {
  title: string;
  content: string;
  kr_id: number;
  object_id: number | string;
  okr_title: string;
};

export type WeeklyListItem = {
  id: string;
  user: WeeklyUser;
  weekly: {
    content: WeeklyContentItem[];
    read_count: number;
    like_count: number;
    is_read: boolean;
  };
};

export type WeeklyListParams = {
  query_type?: 'person' | 'department' | 'team_id' | 'team_name';
  query_value?: string;
  start_date?: string;
  end_date?: string;
  unread?: boolean;
  sort?: 'asc' | 'desc';
  next_page?: string;
};

/** 查询周报列表（POST /openapi/v2/weekly/list）*/
export async function listWeekly(
  creds: PersonalCreds,
  params: WeeklyListParams,
): Promise<{ list: WeeklyListItem[]; next_page: string }> {
  const body: Record<string, unknown> = { access_token: creds.token };
  if (params.query_type) body.query_type = params.query_type;
  if (params.query_value) body.query_value = params.query_value;
  if (params.start_date) body.start_date = params.start_date;
  if (params.end_date) body.end_date = params.end_date;
  if (params.unread !== undefined) body.unread = params.unread;
  if (params.sort) body.sort = params.sort;
  if (params.next_page) body.next_page = params.next_page;

  const res = await oapiFetch(`${creds.baseUrl}/openapi/v2/weekly/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseOapiJson<{ list?: WeeklyListItem[]; next_page?: string }>(res, 'listWeekly');
  return { list: data.list ?? [], next_page: data.next_page ?? '' };
}
