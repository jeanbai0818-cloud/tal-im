import { createDecipheriv } from 'node:crypto';

/**
 * AES-128-ECB 解密知音楼加密字段（senderId / conversationId / msgId 等）。
 * key 不足 16 字节时右填 \x00。
 */
export function aesDecrypt(encBase64: string, appKey: string): string {
  const keyBuf = Buffer.alloc(16, 0);
  Buffer.from(appKey, 'utf-8').copy(keyBuf, 0, 0, Math.min(appKey.length, 16));

  const encBuf = Buffer.from(encBase64, 'base64');

  const decipher = createDecipheriv('aes-128-ecb', keyBuf, null);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(encBuf), decipher.final()]);

  const padLen = decrypted[decrypted.length - 1];
  return decrypted.slice(0, decrypted.length - padLen).toString('utf-8');
}
