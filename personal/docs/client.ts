import { oapiFetch } from '../../core/oapi/fetch.js';
import { YachApiError } from '../../core/oapi/errors.js';
import type { PersonalCreds } from '../shared.js';

export type DocLocator = {
  fileUrl?: string;
  guid?: string;
  knNodeId?: string;
};

/** 判断业务码是否成功（兼容 code / errcode / result 三种字段）*/
function isOk(data: Record<string, unknown>): boolean {
  const raw = data.code ?? data.errcode ?? data.result;
  const n = Number(raw);
  return n === 0 || n === 200;
}

/** 提取文档内容响应中的 content 字段（兼容 obj.content / result.content）*/
function extractContent(data: Record<string, unknown>): string {
  const obj = (data.obj ?? data.result) as { content?: string } | undefined;
  return obj?.content ?? '';
}

function buildLocatorQs(token: string, loc: DocLocator): URLSearchParams {
  const qs = new URLSearchParams({ access_token: token });
  if (loc.fileUrl) qs.set('file_url', loc.fileUrl);
  if (loc.guid) qs.set('guid', loc.guid);
  if (loc.knNodeId) qs.set('kn_node_id', loc.knNodeId);
  return qs;
}

async function parseDocText(res: Response, context: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`[yach-doc] ${context}: JSON parse error (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!isOk(data)) {
    const code = Number(data.code ?? data.errcode ?? -1);
    const msg = String(data.msg ?? data.message ?? text.slice(0, 200));
    throw new YachApiError(`[yach-doc] ${context} failed: ${msg}`, code);
  }
  return data;
}

/** 读取文档 Markdown 内容（GET /openapi/v2/doc/content/md）*/
export async function readDocMarkdown(creds: PersonalCreds, loc: DocLocator): Promise<string> {
  const qs = buildLocatorQs(creds.token, loc);
  const res = await oapiFetch(`${creds.baseUrl}/openapi/v2/doc/content/md?${qs}`);
  const data = await parseDocText(res, 'readDocMarkdown');
  return extractContent(data);
}

/** 读取文档纯文本内容（GET /openapi/v2/doc/content）*/
export async function readDocText(creds: PersonalCreds, loc: DocLocator): Promise<string> {
  const qs = buildLocatorQs(creds.token, loc);
  const res = await oapiFetch(`${creds.baseUrl}/openapi/v2/doc/content?${qs}`);
  const data = await parseDocText(res, 'readDocText');
  return extractContent(data);
}

/** 向文档末尾追加内容（POST /openapi/v2/doc/content/append）*/
export async function appendDoc(
  creds: PersonalCreds,
  loc: DocLocator,
  content: string,
): Promise<void> {
  const body: Record<string, string> = { access_token: creds.token, content };
  if (loc.fileUrl) body.file_url = loc.fileUrl;
  if (loc.guid) body.guid = loc.guid;
  if (loc.knNodeId) body.kn_node_id = loc.knNodeId;
  const res = await oapiFetch(`${creds.baseUrl}/openapi/v2/doc/content/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await parseDocText(res, 'appendDoc');
}
