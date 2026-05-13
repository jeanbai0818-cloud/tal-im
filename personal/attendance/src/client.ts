import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { STATE_DIR } from 'openclaw/plugin-sdk/state-paths';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_API_BASE = 'https://yach-capi.zhiyinlou.com';
const SESSION_FILE = path.join(STATE_DIR, 'identity', 'session', 'current.json');
const ATTENDANCE_STATE_DIR = path.join(STATE_DIR, 'identity', 'attendance');

function resolveRuntimeRoot(): string {
  const candidates = [
    fileURLToPath(new URL('../../../../../runtime/attendance-python/', import.meta.url)),
    fileURLToPath(new URL('../../../../runtime/attendance-python/', import.meta.url)),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!;
}

function sanitizeEnv(base: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === 'string') env[k] = v;
  }
  return env;
}

function normalizeOutput(stdout: string, stderr: string): string {
  const merged = stdout.trim() || stderr.trim();
  if (!merged) return '(no output)';
  try {
    return JSON.stringify(JSON.parse(merged), null, 2);
  } catch {
    return merged;
  }
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Clock out (下班打卡). Address is optional — omit to use the location from the API. */
export async function punchOffDuty(address?: string): Promise<string> {
  const runtimeRoot = resolveRuntimeRoot();
  const runtimeDir = path.join(ATTENDANCE_STATE_DIR, 'runtime');
  const memoryDir = path.join(ATTENDANCE_STATE_DIR, 'memory');

  await Promise.all([ensureDir(runtimeDir), ensureDir(memoryDir)]);

  const pythonBin = process.env.YACH_ATTENDANCE_PYTHON ?? 'python3';
  const args = ['-m', 'yachattend', 'attendance', 'update-offduty'];
  if (address?.trim()) args.push(address.trim());

  const env = sanitizeEnv({
    ...process.env,
    PYTHONPATH: [runtimeRoot, path.join(runtimeRoot, 'vendor'), process.env.PYTHONPATH]
      .filter(Boolean)
      .join(path.delimiter),
    PYTHONUNBUFFERED: '1',
    YACH_ATTENDANCE_SKIP_VENV_REEXEC: '1',
    YACH_ATTENDANCE_WORKSPACE_DIR: runtimeRoot,
    YACH_ATTENDANCE_RUNTIME_DIR: runtimeDir,
    YACH_ATTENDANCE_MEMORY_DIR: memoryDir,
    YACH_ATTENDANCE_SESSION_FILE: SESSION_FILE,
    YACH_ATTENDANCE_PLUGIN_API_BASE_URL: DEFAULT_API_BASE,
    YACH_ATTENDANCE_TIMEOUT: String(DEFAULT_TIMEOUT_MS / 1000),
  });

  const result = await execFileAsync(pythonBin, args, {
    cwd: runtimeRoot,
    env,
    encoding: 'utf8',
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });

  return normalizeOutput(result.stdout, result.stderr);
}

/** Run attendance doctor (diagnostics only, no punch). */
export async function attendanceDoctor(): Promise<string> {
  const runtimeRoot = resolveRuntimeRoot();
  const runtimeDir = path.join(ATTENDANCE_STATE_DIR, 'runtime');
  const memoryDir = path.join(ATTENDANCE_STATE_DIR, 'memory');

  await Promise.all([ensureDir(runtimeDir), ensureDir(memoryDir)]);

  const pythonBin = process.env.YACH_ATTENDANCE_PYTHON ?? 'python3';
  const args = ['-m', 'yachattend', 'attendance', 'doctor'];

  const env = sanitizeEnv({
    ...process.env,
    PYTHONPATH: [runtimeRoot, path.join(runtimeRoot, 'vendor'), process.env.PYTHONPATH]
      .filter(Boolean)
      .join(path.delimiter),
    PYTHONUNBUFFERED: '1',
    YACH_ATTENDANCE_SKIP_VENV_REEXEC: '1',
    YACH_ATTENDANCE_WORKSPACE_DIR: runtimeRoot,
    YACH_ATTENDANCE_RUNTIME_DIR: runtimeDir,
    YACH_ATTENDANCE_MEMORY_DIR: memoryDir,
    YACH_ATTENDANCE_SESSION_FILE: SESSION_FILE,
    YACH_ATTENDANCE_PLUGIN_API_BASE_URL: DEFAULT_API_BASE,
    YACH_ATTENDANCE_TIMEOUT: '30',
  });

  const result = await execFileAsync(pythonBin, args, {
    cwd: runtimeRoot,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: MAX_BUFFER,
  });

  return normalizeOutput(result.stdout, result.stderr);
}
