const encoder = new TextEncoder();
const cookieName = "se_demo_session";
const lifetime = 7 * 86400000;

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
async function signature(text: string, secret: string) {
  return hex(
    await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(text)),
  );
}
export async function anonymousSession(
  request: Request,
  secret: string,
  now = Date.now(),
) {
  const raw =
    request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) ?? "";
  const [id, timestamp, sig] = raw.split(".");
  const issued = Number(timestamp);
  let valid = false;
  if (
    /^[a-f0-9-]{36}$/.test(id ?? "") &&
    /^[a-f0-9]{64}$/.test(sig ?? "") &&
    Number.isSafeInteger(issued) &&
    issued <= now &&
    now - issued < lifetime
  ) {
    const bytes = Uint8Array.from(sig.match(/../g)!, (pair) =>
      parseInt(pair, 16),
    );
    valid = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      bytes,
      encoder.encode(`${id}.${timestamp}`),
    );
  }
  const identity = valid ? id : crypto.randomUUID();
  const cookie = valid
    ? null
    : `${cookieName}=${identity}.${now}.${await signature(`${identity}.${now}`, secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime / 1000}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  // Store keyed digests, never raw addresses or browser identifiers.
  const ip =
    process.env.DATA_DRIVER === "d1"
      ? (request.headers.get("cf-connecting-ip") ?? "unknown")
      : "local";
  return {
    sessionKey: await signature(`session:${identity}`, secret),
    ipKey: await signature(`ip:${ip}`, secret),
    cookie,
  };
}
