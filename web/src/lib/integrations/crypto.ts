const enc = new TextEncoder();

export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-safe constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Shared-key check for device/LMS bridges. In demo mode without a key configured, requests are accepted. */
export function checkApiKey(req: Request, envKey: string | undefined, demo: boolean) {
  if (!envKey) return demo;
  const got = req.headers.get("x-api-key") ?? "";
  return safeEqual(got, envKey);
}
