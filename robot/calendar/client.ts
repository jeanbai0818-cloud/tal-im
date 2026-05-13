import { getBotToken } from '../../core/auth/bot/token.js';
import { OAPI_BASE } from '../../core/shared/constants.js';
import { oapiFetch, parseOapiJson } from '../../core/oapi/fetch.js';

export type ScheduleItem = {
  eventId: string;
  scheduleId: string;
  title: string;
  remark?: string;
  address?: string;
  beginTime: number;   // Unix seconds
  finishTime: number;  // Unix seconds
  state?: number;
  isRepeat?: boolean;
  participantNum?: number;
  creator?: string;    // yachid of creator
};

type RawSchedule = {
  event_id: string;
  schedule_id: string;
  title: string;
  remark?: string;
  address?: string;
  begin_time: number;
  finish_time: number;
  state?: number;
  is_repeat?: number;
  participant_num?: number;
  creator?: string;
};

function toScheduleItem(r: RawSchedule): ScheduleItem {
  return {
    eventId: r.event_id,
    scheduleId: r.schedule_id,
    title: r.title,
    remark: r.remark,
    address: r.address,
    beginTime: r.begin_time,
    finishTime: r.finish_time,
    state: r.state,
    isRepeat: r.is_repeat === 1,
    participantNum: r.participant_num,
    creator: r.creator,
  };
}

type Creds = { appKey: string; appSecret: string; baseUrl?: string };

function base(creds: Creds): string {
  return creds.baseUrl ?? OAPI_BASE;
}

async function postSchedule<T>(
  creds: Creds,
  path: string,
  body: Record<string, unknown>,
  context: string,
): Promise<T> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(`${base(creds)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, ...body }),
  });
  return parseOapiJson<T>(res, context);
}

export type ListSchedulesParams = {
  /** Unix seconds */
  startTime: number;
  /** Unix seconds */
  endTime: number;
  /** Include cancelled events (0/1) */
  hasCancel?: number;
  /** Include declined events (0/1) */
  hasRefuse?: number;
  /** Include self-created events (0/1) */
  hasSelf?: number;
  /** Filter by work codes (max 10) */
  workCodes?: string[];
};

/** 查询日程列表（POST /openapi/v2/schedule/list）*/
export async function listSchedules(
  creds: Creds,
  params: ListSchedulesParams,
): Promise<ScheduleItem[]> {
  const body: Record<string, unknown> = {
    start_time: params.startTime,
    end_time: params.endTime,
  };
  if (params.hasCancel !== undefined) body['has_cancel'] = params.hasCancel;
  if (params.hasRefuse !== undefined) body['has_refuse'] = params.hasRefuse;
  if (params.hasSelf !== undefined) body['has_self'] = params.hasSelf;
  if (params.workCodes?.length) body['work_code'] = params.workCodes;

  const result = await postSchedule<{ list?: RawSchedule[] }>(
    creds, '/openapi/v2/schedule/list', body, 'listSchedules',
  );
  return (result.list ?? []).map(toScheduleItem);
}

export type CreateScheduleParams = {
  title: string;
  /** Unix seconds */
  startTime: number;
  /** Unix seconds */
  endTime: number;
  /** Participant yachids, comma-separated */
  participants?: string;
  remark?: string;
  address?: string;
};

/** 创建日程（POST /openapi/v2/schedule/create）返回 event_id。*/
export async function createSchedule(creds: Creds, params: CreateScheduleParams): Promise<string> {
  const body: Record<string, unknown> = {
    title: params.title,
    start_time: params.startTime,
    end_time: params.endTime,
  };
  if (params.participants) body['participant'] = params.participants;
  if (params.remark) body['remark'] = params.remark;
  if (params.address) body['address'] = params.address;

  const result = await postSchedule<{ event_id?: string }>(
    creds, '/openapi/v2/schedule/create', body, 'createSchedule',
  );
  return result.event_id ?? '';
}

/** 取消/删除日程（POST /openapi/v2/schedule/cancel）*/
export async function cancelSchedule(creds: Creds, scheduleId: string): Promise<void> {
  await postSchedule(
    creds, '/openapi/v2/schedule/cancel', { schedule_id: scheduleId }, 'cancelSchedule',
  );
}

/** 查询日程详情（POST /openapi/v2/schedule/info）*/
export async function getSchedule(creds: Creds, scheduleId: string): Promise<ScheduleItem> {
  const raw = await postSchedule<RawSchedule>(
    creds, '/openapi/v2/schedule/info', { schedule_id: scheduleId }, 'getSchedule',
  );
  return toScheduleItem(raw);
}
