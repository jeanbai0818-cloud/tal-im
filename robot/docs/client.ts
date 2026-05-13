import { getBotToken } from '../../core/auth/bot/token.js';
import { OAPI_BASE } from '../../core/shared/constants.js';
import { oapiFetch } from '../../core/oapi/fetch.js';
import { YachApiError } from '../../core/oapi/errors.js';

type Creds = { appKey: string; appSecret: string; baseUrl?: string };

export type DocLocator = { fileUrl?: string; guid?: string; knNodeId?: string };

export type DocType =
  | 'newdoc'
  | 'folder'
  | 'mosheet'
  | 'presentation'
  | 'mindmap'
  | 'form'
  | 'board';

function base(creds: Creds): string {
  return creds.baseUrl ?? OAPI_BASE;
}

function isOk(data: Record<string, unknown>): boolean {
  const raw = data.code ?? data.errcode ?? data.result;
  const n = Number(raw);
  return n === 0 || n === 200;
}

function extractContent(data: Record<string, unknown>): string {
  const obj = (data.obj ?? data.result) as { content?: string } | undefined;
  return obj?.content ?? '';
}

async function parseDocJson(res: Response, context: string): Promise<Record<string, unknown>> {
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

function buildLocatorQs(token: string, loc: DocLocator): URLSearchParams {
  const qs = new URLSearchParams({ access_token: token });
  if (loc.fileUrl) qs.set('file_url', loc.fileUrl);
  if (loc.guid) qs.set('guid', loc.guid);
  if (loc.knNodeId) qs.set('kn_node_id', loc.knNodeId);
  return qs;
}

/** 读取文档 Markdown（GET /openapi/v2/doc/content/md） */
export async function readDocMarkdown(creds: Creds, loc: DocLocator): Promise<string> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const qs = buildLocatorQs(token, loc);
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/content/md?${qs}`);
  const data = await parseDocJson(res, 'readDocMarkdown');
  return extractContent(data);
}

/** 读取文档纯文本（GET /openapi/v2/doc/content） */
export async function readDocText(creds: Creds, loc: DocLocator): Promise<string> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const qs = buildLocatorQs(token, loc);
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/content?${qs}`);
  const data = await parseDocJson(res, 'readDocText');
  return extractContent(data);
}

/** 向文档末尾追加内容（POST /openapi/v2/doc/content/append） */
export async function appendDoc(creds: Creds, loc: DocLocator, content: string): Promise<void> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const body: Record<string, string> = { access_token: token, content };
  if (loc.fileUrl) body.file_url = loc.fileUrl;
  if (loc.guid) body.guid = loc.guid;
  if (loc.knNodeId) body.kn_node_id = loc.knNodeId;
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/content/append`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await parseDocJson(res, 'appendDoc');
}

/** 创建空白文档（POST /openapi/v2/doc/add） */
export async function createDoc(
  creds: Creds,
  params: { name?: string; type: DocType; folder?: string },
): Promise<{ guid: string; url: string }> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const body: Record<string, string> = { access_token: token, type: params.type };
  if (params.name) body.name = params.name;
  if (params.folder) body.folder = params.folder;
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseDocJson(res, 'createDoc');
  const obj = data.obj as { guid?: string; url?: string } | undefined;
  if (!obj?.guid) throw new Error('[yach-doc] createDoc: missing guid in response');
  return { guid: obj.guid, url: obj.url ?? '' };
}

/** 删除文档（POST /openapi/v2/doc/del） */
export async function deleteDoc(creds: Creds, fileUrl: string): Promise<void> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/del`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: token, file_url: fileUrl }),
  });
  await parseDocJson(res, 'deleteDoc');
}

/** 添加文档协作者（POST /openapi/v2/doc/collaborator/add） */
export async function addCollaborator(
  creds: Creds,
  guid: string,
  workCode: string,
  role: 'viewer' | 'editor' | 'manager' = 'viewer',
): Promise<void> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/collaborator/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: token,
      guid,
      collaborators: [{ work_code: workCode, role }],
    }),
  });
  await parseDocJson(res, 'addCollaborator');
}

/** 获取文档可访问 URL（GET /openapi/v2/doc/url） */
export async function getDocUrl(creds: Creds, guid: string): Promise<string> {
  const token = await getBotToken(creds.appKey, creds.appSecret, base(creds));
  const qs = new URLSearchParams({ access_token: token, guid });
  const res = await oapiFetch(`${base(creds)}/openapi/v2/doc/url?${qs}`);
  const data = await parseDocJson(res, 'getDocUrl');
  const obj = data.obj as { url?: string } | undefined;
  return obj?.url ?? '';
}
