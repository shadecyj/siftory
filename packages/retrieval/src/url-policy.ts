import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { RetrievalError } from "./errors";

const trackingKeys = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);

export function canonicalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || trackingKeys.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function isForbiddenIp(address: string): boolean {
  if (address === "::" || address === "::1" || address.toLowerCase().startsWith("fe80:")) return true;
  if (address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd")) return true;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isForbiddenIp(mapped);
  if (isIP(address) !== 4) return false;
  const parts = address.split(".").map(Number);
  const [a = 0, b = 0] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
}

export async function assertSafePublicUrl(input: string, resolve = lookup): Promise<URL> {
  let url: URL;
  try { url = new URL(input); } catch { throw new RetrievalError("FETCH_BLOCKED", "URL 无效。", false); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new RetrievalError("FETCH_BLOCKED", "只允许公开 HTTP(S) 来源。", false);
  if (url.username || url.password) throw new RetrievalError("FETCH_BLOCKED", "来源 URL 不允许携带凭证。", false);
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new RetrievalError("FETCH_BLOCKED", "本地地址不可抓取。", false);
  if (isIP(hostname) && isForbiddenIp(hostname)) throw new RetrievalError("FETCH_BLOCKED", "私有或保留地址不可抓取。", false);
  const addresses = await resolve(hostname, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((entry) => isForbiddenIp(entry.address))) {
    throw new RetrievalError("FETCH_BLOCKED", "来源解析到不可访问的网络地址。", false);
  }
  return url;
}
