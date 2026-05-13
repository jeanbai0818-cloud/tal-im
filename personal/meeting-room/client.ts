import type { MeetingRoomSession } from './auth.js';
import { mergeCookies, parseCookies, buildCookieHeader, type SimpleCookie } from '../../core/shared/http-cookie.js';

const MEETING_API_ORIGIN = 'https://huiyi.tal.com';
const MEETING_BOOKING_URL = 'https://huiyi.tal.com/booking/booking?to=booking%2Fbooking';

type JsonRecord = Record<string, unknown>;

function ensureRecord(v: unknown): JsonRecord {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as JsonRecord : {};
}

// ── API request helper ────────────────────────────────────────────────────────

async function requestJson(
  cookies: SimpleCookie[],
  options: {
    method: 'GET' | 'POST';
    path: string;
    query?: Record<string, unknown>;
    body?: unknown;
  },
): Promise<{ data: JsonRecord; cookies: SimpleCookie[] }> {
  const qs = options.query
    ? '?' + new URLSearchParams(
        Object.entries(options.query)
          .filter(([, v]) => v !== null && v !== undefined)
          .flatMap(([k, v]) => {
            if (Array.isArray(v)) return v.map((item) => [`${k}[]`, String(item)] as [string, string]);
            return [[k, String(v)] as [string, string]];
          }),
      ).toString()
    : '';
  const url = new URL(`${options.path}${qs}`, MEETING_API_ORIGIN);
  const cookieStr = buildCookieHeader(cookies, url.hostname);
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    Referer: MEETING_BOOKING_URL,
    'User-Agent': 'Mozilla/5.0 Yach-TAL-IM/1.0',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    ...(cookieStr ? { Cookie: cookieStr } : {}),
  };

  let bodyStr: string | undefined;
  if (options.method === 'POST') {
    headers['Content-Type'] = 'application/json;charset=UTF-8';
    bodyStr = JSON.stringify(options.body ?? {});
  }

  const res = await fetch(url.toString(), { method: options.method, headers, body: bodyStr });
  const newCookies = mergeCookies(cookies, parseCookies(res.headers, url.hostname));

  if (!res.ok) throw new Error(`[meeting-room] ${options.path} HTTP ${res.status}`);
  const payload = ensureRecord(await res.json());
  const code = payload.code;
  if (!(code === 0 || code === '0' || code === undefined || code === null)) {
    const msg = String(payload.message ?? payload.msg ?? '');
    throw new Error(`[meeting-room] ${options.path} 失败 (code=${String(code)}): ${msg}`);
  }
  return { data: payload, cookies: newCookies };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoomScope = { cityId: string; cityName: string; officeId: string; officeName: string };

export type MeetingRoom = {
  id: string;
  guid: string;
  name: string;
  cityName: string;
  officeName: string;
  floorName: string;
  capacity: number | null;
  openTime: string;
  closeTime: string;
  readonly: boolean;
  locked: boolean;
  scope: RoomScope;
};

export type RoomBooking = {
  id: string;
  title: string;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  mine: boolean;
};

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeScope(v: JsonRecord): RoomScope {
  return {
    cityId: String(v.city_id ?? v.cityId ?? ''),
    cityName: String(v.city_name ?? v.cityName ?? ''),
    officeId: String(v.office_id ?? v.officeId ?? ''),
    officeName: String(v.office_name ?? v.officeName ?? ''),
  };
}

function normalizeRoom(raw: JsonRecord, scope: RoomScope): MeetingRoom {
  return {
    id: String(raw.id ?? ''),
    guid: String(raw.guid ?? ''),
    name: String(raw.name ?? ''),
    cityName: String(raw.cityname ?? raw.city_name ?? scope.cityName ?? ''),
    officeName: String(raw.officename ?? raw.office_name ?? scope.officeName ?? ''),
    floorName: String(raw.floorname ?? raw.floor_name ?? ''),
    capacity: Number.isFinite(Number(raw.capacity)) ? Number(raw.capacity) : null,
    openTime: String(raw.open ?? raw.opentime ?? ''),
    closeTime: String(raw.close ?? raw.closetime ?? ''),
    readonly: Number(raw.readonly ?? 0) === 1,
    locked: Number(raw.islock ?? 0) === 1,
    scope,
  };
}

function normalizeBooking(raw: JsonRecord): RoomBooking {
  const startTime = String(raw.start_time ?? raw.show_start_time ?? '');
  const endTime = String(raw.end_time ?? raw.show_end_time ?? '');
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    start: startTime.length >= 16 ? startTime.slice(11, 16) : '',
    end: endTime.length >= 16 ? endTime.slice(11, 16) : '',
    startTime,
    endTime,
    mine: Number(raw.myself ?? 0) === 1,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** List all city→office scope pairs. */
export async function listOfficeScopes(session: MeetingRoomSession): Promise<RoomScope[]> {
  const { data } = await requestJson(session.cookies, {
    method: 'GET',
    path: '/prod-api/meeting/city_office_all',
    query: { is_all: 1 },
  });
  const cities = Array.isArray(data.data) ? data.data : [];
  return cities.flatMap((city) => {
    const c = ensureRecord(city);
    const cityId = String(c.id ?? '');
    const cityName = String(c.name ?? '');
    return (Array.isArray(c.children) ? c.children as JsonRecord[] : []).map((office) => ({
      cityId,
      cityName,
      officeId: String(office.id ?? ''),
      officeName: String(office.name ?? ''),
    })).filter((s) => s.cityId && s.officeId);
  });
}

/** List rooms page for a scope. */
export async function listRoomsPage(
  session: MeetingRoomSession,
  params: {
    date: string;
    scope: RoomScope;
    keyword?: string;
    start?: string;
    end?: string;
    free?: boolean;
    page?: number;
    limit?: number;
  },
): Promise<{ rooms: MeetingRoom[]; total: number }> {
  const { data } = await requestJson(session.cookies, {
    method: 'GET',
    path: '/prod-api/meeting/meetingroom_meeting_page',
    query: {
      date: params.date,
      title: params.keyword ?? '',
      page: params.page ?? 1,
      limit: params.limit ?? 100,
      sort: '-order_no',
      floor: [],
      floor_name: '',
      roomresource: [],
      capacity: '',
      start_time: params.start ?? '',
      end_time: params.end ?? '',
      free: params.free === true,
      cityOfficeFloor: [],
      city: params.scope.cityId,
      office: params.scope.officeId,
      city_name: params.scope.cityName,
      office_name: params.scope.officeName,
      city_office: [params.scope.cityId, params.scope.officeId],
    },
  });
  const d = ensureRecord(data.data);
  const items = Array.isArray(d.items) ? d.items as JsonRecord[] : [];
  return {
    total: Number(d.total) || items.length,
    rooms: items.map((r) => normalizeRoom(r, params.scope)).filter((r) => r.id && r.name),
  };
}

/** Get bookings for many rooms on a date. */
export async function listRoomBookings(
  session: MeetingRoomSession,
  roomIds: string[],
  date: string,
): Promise<Record<string, RoomBooking[]>> {
  if (roomIds.length === 0) return {};
  const { data } = await requestJson(session.cookies, {
    method: 'GET',
    path: '/prod-api/meeting/many_room_meeting',
    query: { ids: roomIds.join(','), date },
  });
  const d = ensureRecord(data.data);
  return roomIds.reduce<Record<string, RoomBooking[]>>((acc, id) => {
    const rd = ensureRecord(d[id]);
    const meetings = Array.isArray(rd.meeting) ? rd.meeting as JsonRecord[] : [];
    acc[id] = meetings.map(normalizeBooking).filter((b) => b.id);
    return acc;
  }, {});
}

/** Book a meeting room. Returns meetingId. */
export async function bookRoom(
  session: MeetingRoomSession,
  params: {
    room: MeetingRoom;
    title: string;
    date: string;
    start: string;
    end: string;
    remark?: string;
  },
): Promise<string> {
  const { data } = await requestJson(session.cookies, {
    method: 'POST',
    path: '/prod-api/meeting/add',
    body: {
      title: params.title,
      start_date: params.date,
      end_date: params.date,
      start_time: `${params.date} ${params.start}:00`,
      end_time: `${params.date} ${params.end}:00`,
      all_day: false,
      timezone: 'UTC+08:00',
      iscycle: 0,
      meetingroom: [Number(params.room.id)],
      ...(params.room.guid ? { meetingroom_guid: [params.room.guid], meeting_service: { [params.room.guid]: [] } } : {}),
      remind_times: '5',
      book_person_id: session.userId,
      book_person_name: session.userName,
      book_person_job_num: session.workcode,
      book_source: 1,
      view_permisson: 1,
      remark: params.remark ?? '',
      notice: 1,
      attendees: [{
        id: session.userId,
        user_id: session.userId,
        name: session.userName,
        job_num: session.workcode,
        type: 'user',
      }],
      online_type: 0,
      attendees_max_num: 100,
      book_person: {
        id: session.userId,
        name: session.userName,
        job_num: session.workcode,
      },
    },
  });
  const d = ensureRecord(data.data);
  const meetingId = String(d.id ?? '').trim();
  if (!meetingId) throw new Error('会议室预订成功但接口未返回 meeting id');
  return meetingId;
}

/** Cancel (delete) a meeting by ID. */
export async function cancelBooking(session: MeetingRoomSession, meetingId: string): Promise<void> {
  await requestJson(session.cookies, {
    method: 'POST',
    path: '/prod-api/meeting/del',
    body: { id: Number(meetingId) },
  });
}

/** Get meeting details. */
export async function getMeetingDetails(session: MeetingRoomSession, meetingId: string): Promise<JsonRecord> {
  const { data } = await requestJson(session.cookies, {
    method: 'GET',
    path: '/prod-api/meeting/details',
    query: { id: meetingId },
  });
  return ensureRecord(data.data);
}
