import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';
import { textResult } from 'openclaw/plugin-sdk/agent-runtime';

import { getMeetingRoomSession } from './auth.js';
import {
  listOfficeScopes, listRoomsPage, listRoomBookings, bookRoom, cancelBooking, getMeetingDetails,
  type MeetingRoom, type RoomScope,
} from './client.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseDate(v: string): string {
  if (!DATE_RE.test(v)) throw new Error(`日期格式必须是 YYYY-MM-DD: ${v}`);
  return v;
}
function parseTime(v: string, label: string): string {
  if (!TIME_RE.test(v)) throw new Error(`${label} 格式必须是 HH:MM: ${v}`);
  return v;
}

function normalizeText(v: string): string {
  return v.trim().replace(/\s+/g, '').toLowerCase();
}

function selectScope(scopes: RoomScope[], office: string, city?: string): RoomScope {
  let candidates = scopes;
  if (city) {
    const n = normalizeText(city);
    const matched = candidates.filter(
      (s) => normalizeText(s.cityName).includes(n) || normalizeText(s.cityId) === n,
    );
    if (matched.length > 0) candidates = matched;
  }
  const n = normalizeText(office);
  const exact = candidates.filter(
    (s) => normalizeText(s.officeName) === n || normalizeText(s.officeId) === n,
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const preview = exact.slice(0, 5).map((s) => `${s.cityName}/${s.officeName}`).join('；');
    throw new Error(`匹配到多个办公区，请添加 city 参数缩小范围: ${preview}`);
  }
  const fuzzy = candidates.filter((s) => normalizeText(s.officeName).includes(n));
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) {
    const preview = fuzzy.slice(0, 5).map((s) => `${s.cityName}/${s.officeName}`).join('；');
    throw new Error(`模糊匹配到多个办公区: ${preview}`);
  }
  throw new Error(`找不到办公区: ${office}`);
}

function pickRoom(rooms: MeetingRoom[], query: string): MeetingRoom {
  const n = normalizeText(query);
  const exact = rooms.filter((r) =>
    [r.id, r.guid, r.name].map(normalizeText).some((c) => c === n),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const preview = exact.slice(0, 5).map((r) => `${r.name}(id=${r.id})`).join('；');
    throw new Error(`匹配到多个会议室，请使用更精确的名字或 id: ${preview}`);
  }
  const fuzzy = rooms.filter((r) =>
    [r.id, r.guid, r.name, r.floorName].map(normalizeText).some((c) => c.includes(n)),
  );
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) {
    const preview = fuzzy.slice(0, 5).map((r) => `${r.name}(id=${r.id})`).join('；');
    throw new Error(`模糊匹配到多个会议室: ${preview}`);
  }
  throw new Error(`找不到会议室: ${query}`);
}

async function fetchAllRooms(
  session: Awaited<ReturnType<typeof getMeetingRoomSession>>,
  scope: RoomScope,
  params: { date: string; keyword?: string; start?: string; end?: string; free?: boolean },
): Promise<MeetingRoom[]> {
  const PAGE_SIZE = 100;
  const all: MeetingRoom[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await listRoomsPage(session, { ...params, scope, page, limit: PAGE_SIZE });
    all.push(...result.rooms);
    if (result.rooms.length < PAGE_SIZE) break;
  }
  return all;
}

function formatRoom(r: MeetingRoom, bookings?: { start: string; end: string }[]): string {
  const loc = [r.cityName, r.officeName, r.floorName].filter(Boolean).join(' / ');
  const cap = r.capacity != null ? ` 容量${r.capacity}人` : '';
  const status = r.locked ? ' [锁定]' : r.readonly ? ' [只读]' : '';
  const bookStr = bookings && bookings.length > 0
    ? ` 已有预订: ${bookings.slice(0, 3).map((b) => `${b.start}-${b.end}`).join(', ')}`
    : '';
  return `${r.name}（${loc}${cap}${status} id=${r.id}）${bookStr}`;
}

export function registerMeetingRoomTools(api: OpenClawPluginApi): void {

  api.registerTool({
    name: 'yach_meeting_search_rooms',
    label: '会议室查询',
    description: '查询指定日期/时段的可用会议室（需扫码登录）。可按办公区、城市、关键字过滤。返回会议室列表及当日已有预订情况。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '日期 YYYY-MM-DD' },
        start: { type: 'string', description: '开始时间 HH:MM' },
        end: { type: 'string', description: '结束时间 HH:MM' },
        office: { type: 'string', description: '办公区名称（可选，如"望京"）' },
        city: { type: 'string', description: '城市名称（可选，office 不唯一时补充）' },
        keyword: { type: 'string', description: '会议室名称关键字（可选）' },
        free_only: { type: 'boolean', description: '仅返回该时段空闲的会议室，默认 true' },
      },
      required: ['date', 'start', 'end'],
    },
    async execute(_id: string, rawParams: unknown) {
      const p = rawParams as {
        date: string; start: string; end: string;
        office?: string; city?: string; keyword?: string; free_only?: boolean;
      };
      try {
        const date = parseDate(p.date);
        const start = parseTime(p.start, '开始时间');
        const end = parseTime(p.end, '结束时间');
        const freeOnly = p.free_only !== false;

        const session = await getMeetingRoomSession();
        const allScopes = await listOfficeScopes(session);
        if (allScopes.length === 0) return textResult('未获取到办公区列表，请重试', null);

        const scopes = p.office ? [selectScope(allScopes, p.office, p.city)] : allScopes;
        const bucket = new Map<string, MeetingRoom>();
        await Promise.all(scopes.map(async (scope) => {
          const rooms = await fetchAllRooms(session, scope, { date, keyword: p.keyword, start, end, free: freeOnly });
          for (const r of rooms) bucket.set(r.id || r.name, r);
        }));

        let rooms = Array.from(bucket.values());
        // fetch bookings
        const ids = rooms.map((r) => r.id).filter(Boolean);
        const bookingsMap = await listRoomBookings(session, ids, date);

        // filter free if requested
        if (freeOnly) {
          rooms = rooms.filter((r) => {
            const bs = bookingsMap[r.id] ?? [];
            return !bs.some((b) => b.start < end && b.end > start);
          });
        }

        if (rooms.length === 0) {
          return textResult(`${date} ${start}-${end} 无可用会议室`, null);
        }

        rooms.sort((a, b) =>
          (a.cityName + a.officeName + a.floorName + a.name).localeCompare(
            b.cityName + b.officeName + b.floorName + b.name, 'zh-CN'),
        );

        const lines = rooms.slice(0, 30).map((r, i) =>
          `${i + 1}. ${formatRoom(r, bookingsMap[r.id])}`,
        );
        const suffix = rooms.length > 30 ? `\n（仅展示前 30 条，共 ${rooms.length} 间）` : '';
        return textResult(`${date} ${start}-${end} 可用会议室（${rooms.length} 间）:\n${lines.join('\n')}${suffix}`, null);
      } catch (err) {
        return textResult(`查询会议室失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_meeting_book',
    label: '会议室预订',
    description: '预订指定会议室（需扫码登录）。需先用 yach_meeting_search_rooms 确认会议室名称或 id。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '日期 YYYY-MM-DD' },
        start: { type: 'string', description: '开始时间 HH:MM' },
        end: { type: 'string', description: '结束时间 HH:MM' },
        room: { type: 'string', description: '会议室名称或 id（需精确匹配）' },
        title: { type: 'string', description: '会议标题' },
        office: { type: 'string', description: '办公区（可选，当 room 不唯一时辅助定位）' },
        city: { type: 'string', description: '城市（可选）' },
        remark: { type: 'string', description: '备注（可选）' },
      },
      required: ['date', 'start', 'end', 'room', 'title'],
    },
    async execute(_id: string, rawParams: unknown) {
      const p = rawParams as {
        date: string; start: string; end: string;
        room: string; title: string; office?: string; city?: string; remark?: string;
      };
      try {
        const date = parseDate(p.date);
        const start = parseTime(p.start, '开始时间');
        const end = parseTime(p.end, '结束时间');

        const session = await getMeetingRoomSession();
        const allScopes = await listOfficeScopes(session);
        const scopes = p.office ? [selectScope(allScopes, p.office, p.city)] : allScopes;

        const bucket = new Map<string, MeetingRoom>();
        await Promise.all(scopes.map(async (scope) => {
          const rooms = await fetchAllRooms(session, scope, { date, keyword: p.room });
          for (const r of rooms) bucket.set(r.id || r.name, r);
        }));

        const room = pickRoom(Array.from(bucket.values()), p.room);
        const meetingId = await bookRoom(session, { room, title: p.title, date, start, end, remark: p.remark });

        return textResult(
          `✅ 会议室已预订\n会议室: ${formatRoom(room)}\n时间: ${date} ${start}-${end}\n标题: ${p.title}\n预订ID: ${meetingId}`,
          null,
        );
      } catch (err) {
        return textResult(`预订会议室失败: ${String(err)}`, null);
      }
    },
  });

  api.registerTool({
    name: 'yach_meeting_cancel',
    label: '取消会议室预订',
    description: '根据预订 ID 取消会议室预订（需扫码登录）。预订 ID 可从 yach_meeting_book 返回结果中获取。',
    parameters: {
      type: 'object',
      properties: {
        meeting_id: { type: 'string', description: '预订 ID（数字字符串）' },
      },
      required: ['meeting_id'],
    },
    async execute(_id: string, rawParams: unknown) {
      const p = rawParams as { meeting_id: string };
      try {
        const session = await getMeetingRoomSession();
        // Try to fetch details before cancelling for a better confirmation message
        let summary = '';
        try {
          const details = await getMeetingDetails(session, p.meeting_id);
          const title = String(details.title ?? '');
          const startTime = String(details.start_time ?? '');
          const room = (details.current_meetingroom as Record<string, unknown> | undefined);
          const roomName = room ? String(room.name ?? '') : '';
          summary = [title, startTime.slice(0, 16), roomName].filter(Boolean).join(' ');
        } catch {
          // proceed without summary
        }
        await cancelBooking(session, p.meeting_id);
        return textResult(
          `✅ 预订已取消 (ID: ${p.meeting_id})${summary ? `\n原预订: ${summary}` : ''}`,
          null,
        );
      } catch (err) {
        return textResult(`取消预订失败: ${String(err)}`, null);
      }
    },
  });
}
