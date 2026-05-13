import type { MailSession } from './auth.js';
import { buildCookieHeader } from '../../core/shared/http-cookie.js';

// ── var= body encoder ─────────────────────────────────────────────────────────

function encodeVar(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  function add(prefix: string, val: unknown): void {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      val.forEach((v, i) => add(`${prefix}[${i}]`, v));
    } else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        add(prefix ? `${prefix}[${k}]` : k, v);
      }
    } else {
      qs.append(prefix, String(val));
    }
  }
  for (const [k, v] of Object.entries(params)) add(k, v);
  return qs.toString();
}

// ── wmsvr request helper ──────────────────────────────────────────────────────

async function wmsvr(
  session: MailSession,
  func: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const url = `${session.baseUrl}/s?sid=${encodeURIComponent(session.sid)}&func=${encodeURIComponent(func)}`;
  const host = new URL(session.baseUrl).hostname;
  const cookieStr = buildCookieHeader(session.cookies, host);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
    body: `var=${encodeURIComponent(encodeVar(params))}`,
  });

  if (!res.ok) throw new Error(`[yach-mail] ${func} HTTP ${res.status}`);

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`[yach-mail] ${func}: JSON parse error: ${text.slice(0, 200)}`);
  }
  const d = data as { code?: string; var?: unknown };
  if (d.code !== 'S_OK') {
    throw new Error(`[yach-mail] ${func} failed (code=${d.code ?? 'unknown'}): ${text.slice(0, 300)}`);
  }
  return d.var;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MailMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  sentAt: number | null;
  receivedAt: number | null;
  hasAttachments: boolean;
};

// ── Operations ────────────────────────────────────────────────────────────────

/** 初始化草稿，返回 compose ID */
async function initCompose(session: MailSession): Promise<string> {
  const result = await wmsvr(session, 'mbox:compose', { action: 'new', id: '' });
  if (typeof result === 'string') return result;
  const r = result as { id?: string; draftId?: string };
  return r.id ?? r.draftId ?? String(result);
}

/** 发送邮件 */
export async function sendMail(
  session: MailSession,
  to: string[],
  subject: string,
  body: string,
  cc: string[] = [],
): Promise<void> {
  const composeId = await initCompose(session);
  await wmsvr(session, 'mbox:compose', {
    riskHitIntercept: true,
    id: composeId,
    attrs: {
      account: session.email,
      showOneRcpt: false,
      to,
      cc,
      bcc: [],
      subject,
      isHtml: false,
      content: body,
      priority: 0,
      requestReadReceipt: false,
      saveSentCopy: true,
    },
    returnInfo: false,
    action: 'deliver',
  });
}

/** 列出收件箱消息（fid=1 为收件箱） */
export async function listInbox(session: MailSession, limit = 20): Promise<MailMessage[]> {
  const result = await wmsvr(session, 'mbox:listMessages', {
    fid: 1,
    limit,
    returnTotal: false,
    order: 'date',
    desc: true,
  });
  const items = Array.isArray(result) ? result : [];
  return items.map((m: Record<string, unknown>) => ({
    id: String(m.id ?? ''),
    from: String(m.from ?? ''),
    to: String(m.to ?? ''),
    subject: String(m.subject ?? '(无主题)'),
    sentAt: m.sentDate ? Number(m.sentDate) : null,
    receivedAt: m.receivedDate ? Number(m.receivedDate) : null,
    hasAttachments: Boolean(m.hasAttachments),
  }));
}

/** 按主题关键字搜索邮件 */
export async function searchMails(
  session: MailSession,
  keyword: string,
  limit = 20,
): Promise<MailMessage[]> {
  const result = await wmsvr(session, 'mbox:searchMessages', {
    conditions: [{ field: 'subject', operator: 'contains', operand: keyword }],
    limit,
  });
  const items = Array.isArray(result) ? result : [];
  // searchMessages returns message IDs or objects; try to get infos
  if (items.length === 0) return [];
  const ids = items.map((m) => (typeof m === 'string' || typeof m === 'number' ? String(m) : String((m as Record<string, unknown>).id ?? '')));
  const infos = await wmsvr(session, 'mbox:getMessageInfos', { ids }) as unknown[];
  return (Array.isArray(infos) ? infos : []).map((m: unknown) => {
    const msg = m as Record<string, unknown>;
    return {
      id: String(msg.id ?? ''),
      from: String(msg.from ?? ''),
      to: String(msg.to ?? ''),
      subject: String(msg.subject ?? '(无主题)'),
      sentAt: msg.sentDate ? Number(msg.sentDate) : null,
      receivedAt: msg.receivedDate ? Number(msg.receivedDate) : null,
      hasAttachments: Boolean(msg.hasAttachments),
    };
  });
}
