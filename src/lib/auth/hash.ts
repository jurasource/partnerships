import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashCode(plaintext: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(plaintext, salt, KEYLEN)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyCode(plaintext: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const storedBuf = Buffer.from(hashHex, "hex");
  const derivedBuf = (await scryptAsync(plaintext, salt, KEYLEN)) as Buffer;
  // timingSafeEqual prevents timing attacks
  return storedBuf.length === derivedBuf.length && timingSafeEqual(storedBuf, derivedBuf);
}
