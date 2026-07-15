import crypto from "node:crypto";

/**
 * تحقق ثنائي TOTP (RFC 6238) — يعمل مع تطبيقات المصادقة
 * (Google Authenticator, Microsoft Authenticator, Authy...)
 * بدون أي خدمة خارجية أو رسائل SMS.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

/** يقبل الرمز الحالي مع نافذة ±30 ثانية لتفادي انحراف الساعة */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6 || !secret) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (let i = -window; i <= window; i++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secret, counter + i)), Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthUrl(email: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent("نُزه")}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent("Nuzh")}&algorithm=SHA1&digits=6&period=30`;
}
