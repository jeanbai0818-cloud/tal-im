import path from 'node:path';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { renderQrTerminal } from 'openclaw/plugin-sdk/media-runtime';
import type { YachQrCode } from '../../shared/types.js';

const require = createRequire(import.meta.url);

type QrVendor = {
  addData: (input: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};
type QrVendorConstructor = new (typeNumber: number, errorLevel: number) => QrVendor;
type QrErrorLevel = { L: number };

const MODULE_PX = 8;
const MARGIN = 4;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Pre-computed CRC32 lookup table
const CRC32 = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC32[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function buildQrMatrix(url: string): QrVendor {
  const QrCode: QrVendorConstructor = require('qrcode-terminal/vendor/QRCode');
  const { L }: QrErrorLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');
  const qr = new QrCode(-1, L);
  qr.addData(url);
  qr.make();
  return qr;
}

/** Render a QR code URL as a PNG buffer. */
export function renderQrPng(url: string): Buffer {
  const qr = buildQrMatrix(url);
  const n = qr.getModuleCount();
  const total = n + MARGIN * 2;
  const size = total * MODULE_PX;
  const rowBytes = 1 + size * 4; // filter byte + RGBA
  const raw = Buffer.alloc(rowBytes * size, 0xff);

  let off = 0;
  for (let py = 0; py < size; py++) {
    raw[off++] = 0; // PNG filter: None
    const mr = Math.floor(py / MODULE_PX) - MARGIN;
    for (let px = 0; px < size; px++) {
      const mc = Math.floor(px / MODULE_PX) - MARGIN;
      const dark = mr >= 0 && mr < n && mc >= 0 && mc < n && qr.isDark(mr, mc);
      const v = dark ? 0x00 : 0xff;
      raw[off++] = v; raw[off++] = v; raw[off++] = v; raw[off++] = 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export type QrArtifacts = {
  pngPath: string | null;
  txtPath: string | null;
};

/**
 * Write QR image files to workspaceDir/yach-login/.
 * Saves timestamped versions plus overwriting latest.{png,txt}.
 * Returns null paths on any write error.
 */
export async function writeQrFiles(
  workspaceDir: string,
  qrCode: YachQrCode,
): Promise<QrArtifacts> {
  const dir = path.join(workspaceDir, 'yach-login');
  const slug = `qr-${qrCode.sessionId.replace(/[^a-z0-9_-]/gi, '-')}-${Date.now()}`;

  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    const png = renderQrPng(qrCode.url);
    const pngFile = path.join(dir, `${slug}.png`);
    const latestPng = path.join(dir, 'latest.png');
    await fs.writeFile(pngFile, png, { mode: 0o600 });
    await fs.copyFile(pngFile, latestPng);

    const ascii = await renderQrTerminal(qrCode.url, { small: false });
    const txtFile = path.join(dir, `${slug}.txt`);
    const latestTxt = path.join(dir, 'latest.txt');
    const meta = `Yach login QR\nsessionId: ${qrCode.sessionId}\nurl: ${qrCode.url}\n\n${ascii}`;
    await fs.writeFile(txtFile, meta, { encoding: 'utf8', mode: 0o600 });
    await fs.copyFile(txtFile, latestTxt);

    return { pngPath: latestPng, txtPath: latestTxt };
  } catch {
    return { pngPath: null, txtPath: null };
  }
}

/** Print QR to stdout as ASCII art for terminal scanning. */
export async function printQrToTerminal(qrCode: YachQrCode): Promise<void> {
  const ascii = await renderQrTerminal(qrCode.url, { small: true });
  process.stdout.write('\n知音楼 App — 扫描以下二维码登录：\n\n');
  process.stdout.write(ascii.trimEnd() + '\n\n');
}
