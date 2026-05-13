import path from 'node:path';
import fs from 'node:fs/promises';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';

const SNAPSHOT_PATH = path.join(STATE_DIR, 'identity', 'contact-directory', 'snapshot.json');

export type OrgNode = {
  deptId: string;
  name: string;
  path: string;
  pathSegments: string[];
  memberCount: number | null;
  childDeptIds: string[];
};

export type ContactRecord = {
  id: string;
  name: string;
  displayName?: string;
  workcode: string;
  deptId: string;
  dept: string;
  position?: string;
  deptPaths?: string[];
  onJob: boolean;
  external?: boolean;
};

export type OrgSnapshot = {
  syncedAt: number;
  rootOrg: string;
  orgNodes: OrgNode[];
  contacts: ContactRecord[];
};

export async function loadSnapshot(): Promise<OrgSnapshot | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
    return JSON.parse(raw) as OrgSnapshot;
  } catch {
    return null;
  }
}

/** 按姓名、工号、部门关键字搜索联系人 */
export async function searchContacts(query: string, limit = 20): Promise<ContactRecord[]> {
  const snap = await loadSnapshot();
  if (!snap) return [];
  const q = query.toLowerCase();
  return snap.contacts
    .filter(
      (c) =>
        c.onJob !== false &&
        (c.name.toLowerCase().includes(q) ||
          c.workcode.toLowerCase().includes(q) ||
          c.dept.toLowerCase().includes(q) ||
          (c.position ?? '').toLowerCase().includes(q)),
    )
    .slice(0, limit);
}

/** 按部门名称或路径关键字搜索部门节点 */
export async function searchDepts(query: string): Promise<OrgNode[]> {
  const snap = await loadSnapshot();
  if (!snap) return [];
  const q = query.toLowerCase();
  return snap.orgNodes.filter(
    (n) => n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q),
  );
}

/** 按部门 ID 获取该部门的直属成员 */
export async function listDeptMembers(deptId: string): Promise<ContactRecord[]> {
  const snap = await loadSnapshot();
  if (!snap) return [];
  return snap.contacts.filter((c) => c.deptId === deptId && c.onJob !== false);
}

/** 获取与某人同部门的同事列表 */
export async function getPeers(
  query: string,
  limit = 20,
): Promise<{ person: ContactRecord | null; peers: ContactRecord[] }> {
  const snap = await loadSnapshot();
  if (!snap) return { person: null, peers: [] };
  const q = query.toLowerCase();
  const person = snap.contacts.find(
    (c) =>
      c.name.toLowerCase() === q ||
      c.workcode.toLowerCase() === q ||
      (c.displayName ?? '').toLowerCase() === q,
  ) ?? null;
  if (!person) return { person: null, peers: [] };
  const peers = snap.contacts
    .filter((c) => c.deptId === person.deptId && c.id !== person.id && c.onJob !== false)
    .slice(0, limit);
  return { person, peers };
}

export function snapshotAge(snap: OrgSnapshot): string {
  const diffMs = Date.now() - snap.syncedAt;
  const days = Math.floor(diffMs / 86400000);
  return days === 0 ? '今天' : `${days} 天前`;
}
